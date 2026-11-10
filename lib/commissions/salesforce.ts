import { Connection } from 'jsforce'
import type { SFCommissionOpportunity } from './types'
import { ONBOARDING_COMMISSION_START, ONBOARDING_PRODUCT_FAMILY, ONBOARDING_SF_FIELD_NAMES } from './onboarding'
import { summarizeInvoiceLines, type MaxioInvoiceLine } from './maxio'

let _conn: Connection | null = null

async function getConn(): Promise<Connection> {
  if (_conn) return _conn
  let conn: Connection
  if (process.env.SF_ACCESS_TOKEN && process.env.SF_INSTANCE_URL) {
    conn = new Connection({
      accessToken: process.env.SF_ACCESS_TOKEN,
      instanceUrl: process.env.SF_INSTANCE_URL,
    })
  } else {
    conn = new Connection({ loginUrl: process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com' })
    await conn.login(
      process.env.SF_USERNAME!,
      (process.env.SF_PASSWORD ?? '') + (process.env.SF_SECURITY_TOKEN ?? '')
    )
  }
  _conn = conn
  return _conn
}

/**
 * The commission owner is the ARR Bookings split owner, not the raw Salesforce Owner or the
 * Revenue split — a deal can be reassigned to a different rep for commission purposes after
 * the fact while the record Owner (and Revenue split) stay put. Every Closed Won deal has
 * exactly one ARR Bookings split at 100% today (Salesforce enforces splits summing to 100%,
 * and none of them are partial in this org), so this picks the highest-percentage split and
 * gives that rep the deal's full amount ("winner-take-most" — a future genuine partial split
 * would not get proportional credit). The split's own dollar amount is ignored — only the
 * percentage is used to resolve ownership; the deal amount stays Net_ARR_Override__c as
 * always. Falls back to the raw Owner if a deal has no qualifying split row.
 */
function mapRecord(r: Record<string, unknown>): SFCommissionOpportunity {
  const owner = r.Owner as Record<string, unknown> | null
  const recordType = r.RecordType as Record<string, unknown> | null
  const splits = (r.OpportunitySplits as { records?: Record<string, unknown>[] } | null)?.records ?? []
  const topSplit = splits.length > 0
    ? [...splits].sort((a, b) => (b.SplitPercentage as number) - (a.SplitPercentage as number))[0]
    : null
  const splitOwner = topSplit?.SplitOwner as Record<string, unknown> | null
  const feeLines = (r.OpportunityLineItems as { records?: Record<string, unknown>[] } | null)?.records ?? []
  return {
    ...(r as unknown as SFCommissionOpportunity),
    onboardingFeeAmount: feeLines.reduce((sum, line) => sum + ((line.TotalPrice as number | null) ?? 0), 0),
    maxioInvoices: null,
    calculatedOnboardingCommission: 0,
    Onboarding_Commission_Paid_Amount_NZD__c: (r.Onboarding_Commission_Paid_Amount_NZD__c as number | null | undefined) ?? null,
    Onboarding_Commission_Paid_Date__c: (r.Onboarding_Commission_Paid_Date__c as string | null | undefined) ?? null,
    OwnerId: (topSplit?.SplitOwnerId as string) ?? (r.OwnerId as string),
    'Owner.Name': (splitOwner?.Name as string) ?? (owner?.Name as string) ?? '',
    recordOwnerName: (owner?.Name as string) ?? '',
    'RecordType.Name': (recordType?.Name as string) ?? null,
  }
}

const COMMISSION_SPLIT_FILTER = `Split_Type_Name__c = 'ARR Bookings' AND SplitPercentage > 0`

const ONBOARDING_SF_FIELDS = ONBOARDING_SF_FIELD_NAMES

let _onboardingFieldsAvailable: boolean | null = null

/**
 * Whether the onboarding commission fields exist on Opportunity yet. Checked once via describe (and cached
 * once true), so this code can ship before the fields are created without breaking every query.
 */
export async function onboardingFieldsAvailable(): Promise<boolean> {
  if (_onboardingFieldsAvailable) return true
  try {
    const conn = await getConn()
    const describe = await conn.sobject('Opportunity').describe()
    const names = new Set(describe.fields.map(f => f.name))
    _onboardingFieldsAvailable = ONBOARDING_SF_FIELDS.every(f => names.has(f))
  } catch {
    _onboardingFieldsAvailable = false
  }
  return _onboardingFieldsAvailable
}

async function opportunityFields(): Promise<string> {
  const onboarding = (await onboardingFieldsAvailable()) ? `, ${ONBOARDING_SF_FIELDS.join(', ')}` : ''
  return `${BASE_OPPORTUNITY_FIELDS}${onboarding}`
}

const BASE_OPPORTUNITY_FIELDS = `
  Id, Name, OwnerId, Owner.Name, RecordTypeId, RecordType.Name,
  StageName, CloseDate, CurrencyIsoCode, Static_Currency_Conversion_Rate__c,
  Net_ARR_Override__c, Contract_Term_Length_Months__c,
  Contract_Start_Date__c, Total_Invoice_Amount_Paid__c, Maxio_Next_Invoice_Date__c,
  Commission_Payout_Threshold__c, Commission_Payout_Threshold_Met__c, Commission_Amount_NZD__c,
  Commission_Paid__c, Commission_Paid_Amount_NZD__c, Commission_Paid_Date__c, Commission_Notes__c,
  (SELECT SplitOwnerId, SplitOwner.Name, SplitPercentage FROM OpportunitySplits WHERE ${COMMISSION_SPLIT_FILTER}),
  (SELECT TotalPrice FROM OpportunityLineItems WHERE Product2.Family = '${ONBOARDING_PRODUCT_FAMILY}')
`

async function queryAllOpportunities(soql: string): Promise<SFCommissionOpportunity[]> {
  const conn = await getConn()
  const result = await conn.query<Record<string, unknown>>(soql)

  const allRecords: Record<string, unknown>[] = [...result.records]
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<Record<string, unknown>>(next.nextRecordsUrl)
    allRecords.push(...next.records)
  }

  return attachMaxioInvoices(allRecords.map(mapRecord))
}

/** Salesforce caps how long a query string can be — 200 Ids per IN clause keeps every chunk well under it. */
const ID_CHUNK = 200

/** Every Maxio invoice line linked to these opportunities, with its parent invoice's status. */
async function fetchMaxioInvoiceLines(opportunityIds: string[]): Promise<MaxioInvoiceLine[]> {
  const conn = await getConn()
  const lines: MaxioInvoiceLine[] = []
  for (let i = 0; i < opportunityIds.length; i += ID_CHUNK) {
    const ids = opportunityIds.slice(i, i + ID_CHUNK).filter(id => SF_ID_PATTERN.test(id))
    if (ids.length === 0) continue
    let page = await conn.query<Record<string, unknown>>(`
      SELECT saasoptics__transaction_sfdc_opportunity__c, saasoptics__item_code__c, saasoptics__item_name__c,
        saasoptics__ili_local_amount__c, saasoptics__invoice_date__c,
        saasoptics__invoices_salesforce_id__r.Name, saasoptics__invoices_salesforce_id__r.saasoptics__invoice_status__c
      FROM saasoptics__invoice_line_item__c
      WHERE saasoptics__transaction_sfdc_opportunity__c IN (${ids.map(id => `'${id}'`).join(',')})
    `)
    for (;;) {
      for (const r of page.records) {
        const invoice = r.saasoptics__invoices_salesforce_id__r as Record<string, unknown> | null
        lines.push({
          opportunityId: r.saasoptics__transaction_sfdc_opportunity__c as string,
          invoiceNumber: (invoice?.Name as string) ?? null,
          invoiceDate: (r.saasoptics__invoice_date__c as string) ?? null,
          invoiceStatus: (invoice?.saasoptics__invoice_status__c as string) ?? null,
          itemCode: (r.saasoptics__item_code__c as string) ?? null,
          itemName: (r.saasoptics__item_name__c as string) ?? null,
          amount: (r.saasoptics__ili_local_amount__c as number | null) ?? 0,
        })
      }
      if (page.done || !page.nextRecordsUrl) break
      page = await conn.queryMore<Record<string, unknown>>(page.nextRecordsUrl)
    }
  }
  return lines
}

/**
 * Replaces the opportunity-line-item estimate with what Maxio actually invoiced and got paid. Deals with no
 * linked Maxio lines keep the estimate. If the Maxio objects can't be read, every deal keeps the estimate.
 */
async function attachMaxioInvoices(opps: SFCommissionOpportunity[]): Promise<SFCommissionOpportunity[]> {
  if (opps.length === 0) return opps
  let lines: MaxioInvoiceLine[]
  try {
    lines = await fetchMaxioInvoiceLines([...new Set(opps.map(o => o.Id))])
  } catch (err) {
    console.error('Maxio invoice lines unavailable — falling back to opportunity line items', err)
    return opps
  }
  const byOpp = new Map<string, MaxioInvoiceLine[]>()
  for (const line of lines) {
    // Match on the 15-char prefix so 15- and 18-char Ids compare equal.
    const key = line.opportunityId.slice(0, 15)
    const list = byOpp.get(key) ?? []
    list.push(line)
    byOpp.set(key, list)
  }
  return opps.map(opp => {
    const oppLines = byOpp.get(opp.Id.slice(0, 15))
    if (!oppLines || oppLines.length === 0) return opp
    const maxioInvoices = summarizeInvoiceLines(oppLines)
    return { ...opp, maxioInvoices, onboardingFeeAmount: maxioInvoices.onboardingInvoiced }
  })
}

export async function fetchCommissionOpportunities(start: string, end: string): Promise<SFCommissionOpportunity[]> {
  return queryAllOpportunities(`
    SELECT ${await opportunityFields()}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      AND CloseDate >= ${start}
      AND CloseDate <= ${end}
    ORDER BY CloseDate ASC
  `)
}

export async function fetchClosedWonOwners(): Promise<{ ownerId: string; ownerName: string }[]> {
  const conn = await getConn()
  const result = await conn.query<{ ownerId: string; ownerName: string }>(`
    SELECT SplitOwnerId ownerId, SplitOwner.Name ownerName
    FROM OpportunitySplit
    WHERE ${COMMISSION_SPLIT_FILTER}
      AND Opportunity.StageName = 'Closed Won'
      AND SplitOwner.IsActive = true
    GROUP BY SplitOwnerId, SplitOwner.Name
  `)
  return result.records
    .map(r => ({ ownerId: r.ownerId, ownerName: r.ownerName }))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}

const SF_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/

const SF_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function fetchCommissionOpportunitiesForOwner(
  ownerId: string,
  start?: string,
  end?: string
): Promise<SFCommissionOpportunity[]> {
  if (!SF_ID_PATTERN.test(ownerId)) {
    throw new Error('Invalid owner id')
  }
  let dateFilter = ''
  if (start || end) {
    if (!start || !end || !SF_DATE_PATTERN.test(start) || !SF_DATE_PATTERN.test(end)) {
      throw new Error('Invalid date range')
    }
    dateFilter = `AND CloseDate >= ${start} AND CloseDate <= ${end}`
  }
  return queryAllOpportunities(`
    SELECT ${await opportunityFields()}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      ${commissionOwnerFilterClause(ownerId)}
      ${dateFilter}
    ORDER BY CloseDate ASC
  `)
}

export async function fetchActiveSalesforceUsers(): Promise<{ id: string; name: string }[]> {
  const conn = await getConn()
  const result = await conn.query<{ Id: string; Name: string }>(`
    SELECT Id, Name FROM User WHERE IsActive = true ORDER BY Name
  `)
  return result.records.map(r => ({ id: r.Id, name: r.Name }))
}

function commissionOwnerFilterClause(ownerId?: string): string {
  if (!ownerId) return ''
  if (!SF_ID_PATTERN.test(ownerId)) {
    throw new Error('Invalid owner id')
  }
  return `AND Id IN (SELECT OpportunityId FROM OpportunitySplit WHERE ${COMMISSION_SPLIT_FILTER} AND SplitOwnerId = '${ownerId}')`
}

/**
 * Deals that may have commission payable now. Partially paid deals stay here (Commission Fully Paid stays unticked
 * until the last payment). With onboarding fields present, deals whose ARR commission is closed out but whose
 * onboarding commission isn't marked paid are included too (pre-filtered to deals with non-recurring revenue) —
 * callers filter to what's actually payable once the onboarding commission has been calculated.
 */
export async function fetchPayableOpportunities(ownerId?: string): Promise<SFCommissionOpportunity[]> {
  // ARR: a commission amount set, not fully paid, and either threshold met or an invoice paid (part-earned deals
  // can have commission payable now — see payments.ts). Deals with no commission amount have nothing payable.
  const arrOwed = `(Commission_Paid__c = false AND Commission_Amount_NZD__c != null
    AND (Commission_Payout_Threshold_Met__c = true OR Total_Invoice_Amount_Paid__c > 0))`
  // Onboarding: no payout recorded yet, with non-recurring revenue, closed since onboarding commission began.
  const onboardingOwed = `(Onboarding_Commission_Paid_Amount_NZD__c = null AND Total_Non_Recurring__c > 0
    AND CloseDate >= ${ONBOARDING_COMMISSION_START})`
  const owedFilter = (await onboardingFieldsAvailable()) ? `AND (${arrOwed} OR ${onboardingOwed})` : `AND ${arrOwed}`
  return queryAllOpportunities(`
    SELECT ${await opportunityFields()}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      ${owedFilter}
      ${commissionOwnerFilterClause(ownerId)}
    ORDER BY OwnerId, Commission_Paid_Date__c
  `)
}

/** Every deal with commission paid (fully or partially) — the source for Payable Summary's pay-run history. */
export async function fetchPaidOpportunities(ownerId?: string): Promise<SFCommissionOpportunity[]> {
  const onboardingPaid = (await onboardingFieldsAvailable()) ? ' OR Onboarding_Commission_Paid_Amount_NZD__c > 0' : ''
  return queryAllOpportunities(`
    SELECT ${await opportunityFields()}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      AND (Commission_Paid__c = true OR Commission_Paid_Amount_NZD__c > 0${onboardingPaid})
      ${commissionOwnerFilterClause(ownerId)}
    ORDER BY Commission_Paid_Date__c DESC
  `)
}

/**
 * Deals with commission still awaiting customer payment: ARR below its payout threshold, plus (with onboarding fields
 * present) deals closed since onboarding commission began whose onboarding commission hasn't been paid out — callers
 * keep only those whose onboarding fee is actually still unpaid.
 */
export async function fetchPendingOpportunities(ownerId?: string): Promise<SFCommissionOpportunity[]> {
  const arrPending = `(Commission_Payout_Threshold_Met__c = false AND Commission_Paid__c = false
    AND (Commission_Payout_Threshold__c != null OR Commission_Amount_NZD__c != null))`
  const onboardingPending = `(Onboarding_Commission_Paid_Amount_NZD__c = null AND Total_Non_Recurring__c > 0
    AND CloseDate >= ${ONBOARDING_COMMISSION_START})`
  const pendingFilter = (await onboardingFieldsAvailable()) ? `(${arrPending} OR ${onboardingPending})` : arrPending
  return queryAllOpportunities(`
    SELECT ${await opportunityFields()}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      AND ${pendingFilter}
      ${commissionOwnerFilterClause(ownerId)}
    ORDER BY OwnerId, Maxio_Next_Invoice_Date__c
  `)
}

export async function updateCommissionFields(
  id: string,
  fields: {
    Commission_Amount_NZD__c?: number | null
    Commission_Notes__c?: string | null
    Commission_Paid__c?: boolean | null
    Commission_Paid_Amount_NZD__c?: number | null
    Commission_Paid_Date__c?: string | null
    Onboarding_Commission_Paid_Amount_NZD__c?: number | null
    Onboarding_Commission_Paid_Date__c?: string | null
  }
): Promise<void> {
  const touchesOnboarding = ONBOARDING_SF_FIELDS.some(f => f in fields)
  if (touchesOnboarding && !(await onboardingFieldsAvailable())) {
    throw new Error(`Onboarding commission fields don't exist on Opportunity yet — ask a Salesforce admin to add ${ONBOARDING_SF_FIELDS.join(' and ')}`)
  }
  const conn = await getConn()
  const result = await conn.sobject('Opportunity').update({ Id: id, ...fields })
  const record = Array.isArray(result) ? result[0] : result
  if (!record.success) {
    const errors = Array.isArray(record.errors)
      ? record.errors.map((e: { message?: string } | string) => (typeof e === 'string' ? e : e.message)).join('; ')
      : String(record.errors)
    throw new Error(`Update failed: ${errors}`)
  }
}
