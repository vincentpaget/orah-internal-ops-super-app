import { Connection } from 'jsforce'
import type { SFCommissionOpportunity } from './types'

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
  return {
    ...(r as unknown as SFCommissionOpportunity),
    OwnerId: (topSplit?.SplitOwnerId as string) ?? (r.OwnerId as string),
    'Owner.Name': (splitOwner?.Name as string) ?? (owner?.Name as string) ?? '',
    recordOwnerName: (owner?.Name as string) ?? '',
    'RecordType.Name': (recordType?.Name as string) ?? null,
  }
}

const COMMISSION_SPLIT_FILTER = `Split_Type_Name__c = 'ARR Bookings' AND SplitPercentage > 0`

const OPPORTUNITY_FIELDS = `
  Id, Name, OwnerId, Owner.Name, RecordTypeId, RecordType.Name,
  StageName, CloseDate, CurrencyIsoCode, Static_Currency_Conversion_Rate__c,
  Net_ARR_Override__c, Contract_Term_Length_Months__c,
  Contract_Start_Date__c, Total_Invoice_Amount_Paid__c, Maxio_Next_Invoice_Date__c,
  Commission_Payout_Threshold__c, Commission_Payout_Threshold_Met__c, Commission_Amount_NZD__c,
  Commission_Paid__c, Commission_Paid_Amount_NZD__c, Commission_Paid_Date__c, Commission_Notes__c,
  (SELECT SplitOwnerId, SplitOwner.Name, SplitPercentage FROM OpportunitySplits WHERE ${COMMISSION_SPLIT_FILTER})
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

  return allRecords.map(mapRecord)
}

export async function fetchCommissionOpportunities(start: string, end: string): Promise<SFCommissionOpportunity[]> {
  return queryAllOpportunities(`
    SELECT ${OPPORTUNITY_FIELDS}
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
    SELECT ${OPPORTUNITY_FIELDS}
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

export async function fetchPayableOpportunities(ownerId?: string): Promise<SFCommissionOpportunity[]> {
  return queryAllOpportunities(`
    SELECT ${OPPORTUNITY_FIELDS}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      AND Commission_Payout_Threshold_Met__c = true
      AND Commission_Paid__c = false
      ${commissionOwnerFilterClause(ownerId)}
    ORDER BY OwnerId, Commission_Paid_Date__c
  `)
}

export async function fetchPendingOpportunities(ownerId?: string): Promise<SFCommissionOpportunity[]> {
  return queryAllOpportunities(`
    SELECT ${OPPORTUNITY_FIELDS}
    FROM Opportunity
    WHERE StageName = 'Closed Won'
      AND Commission_Payout_Threshold_Met__c = false
      AND Commission_Paid__c = false
      AND (Commission_Payout_Threshold__c != null OR Commission_Amount_NZD__c != null)
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
  }
): Promise<void> {
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
