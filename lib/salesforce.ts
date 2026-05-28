import { Connection } from 'jsforce'
import type { SFOpportunity, SFRenewalOpp, SFExpansionOpp } from './types'

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

function mapRecord(r: Record<string, unknown>): SFOpportunity {
  const owner = r.Owner as Record<string, unknown> | null
  const account = r.Account as Record<string, unknown> | null
  return {
    ...(r as unknown as SFOpportunity),
    'Owner.Id': (owner?.Id as string) ?? '',
    'Owner.Name': (owner?.Name as string) ?? '',
    'Owner.Email': (owner?.Email as string) ?? null,
    'Account.Name': (account?.Name as string) ?? '',
  }
}

export async function fetchOpportunities(start: string, end: string): Promise<SFOpportunity[]> {
  const conn = await getConn()
  const soql = `
    SELECT
      Id, Name, AccountId, Account.Name, OwnerId, Owner.Id, Owner.Name, Owner.Email,
      StageName, CloseDate, Probability, NextStep, Type,
      Net_ARR_NZD__c, MEDDICC_Score__c,
      Economic_Buyer__c, Economic_Buyer_Grade_Notes__c,
      Compelling_Event__c, Compelling_Event_Grade_Notes__c,
      Last_Meeting_Date__c, Next_Meeting_Date__c,
      Re_engagement_Date__c, Nurturing_Reason__c,
      Loss_Reason__c, Loss_Reason_Detail__c, Lost_From_Stage__c,
      Alternatives_Considered__c, Why_did_they_choose_us__c,
      What_can_we_do_to_repeat_this_outcome__c,
      CreatedDate, Current_Stage_Duration__c
    FROM Opportunity
    WHERE RecordTypeId = '0127F000001JcfTQAS'
      AND AccountId != '0017F00000XJtiAQAT'
      AND StageName != 'Closed - Duplicated'
      AND CloseDate >= ${start}
      AND CloseDate <= ${end}
    ORDER BY CloseDate ASC
  `
  const result = await conn.query<Record<string, unknown>>(soql)

  const allRecords: Record<string, unknown>[] = [...result.records]
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<Record<string, unknown>>(next.nextRecordsUrl)
    allRecords.push(...next.records)
  }

  return allRecords.map(mapRecord)
}

function mapRenewalRecord(r: Record<string, unknown>): SFRenewalOpp {
  const owner = r.Owner as Record<string, unknown> | null
  const account = r.Account as Record<string, unknown> | null
  const pricebook2 = r.Pricebook2 as Record<string, unknown> | null
  return {
    ...(r as unknown as SFRenewalOpp),
    'Owner.Id': (owner?.Id as string) ?? '',
    'Owner.Name': (owner?.Name as string) ?? '',
    'Account.Name': (account?.Name as string) ?? '',
    'Account.Open_Opps__c': (account?.Open_Opps__c as number) ?? null,
    'Pricebook2.Name': (pricebook2?.Name as string) ?? null,
  }
}

function mapExpansionRecord(r: Record<string, unknown>): SFExpansionOpp {
  const owner = r.Owner as Record<string, unknown> | null
  const account = r.Account as Record<string, unknown> | null
  const pricebook2 = r.Pricebook2 as Record<string, unknown> | null
  return {
    ...(r as unknown as SFExpansionOpp),
    'Owner.Id': (owner?.Id as string) ?? '',
    'Owner.Name': (owner?.Name as string) ?? '',
    'Account.Name': (account?.Name as string) ?? '',
    'Account.Open_Opps__c': (account?.Open_Opps__c as number) ?? null,
    'Pricebook2.Name': (pricebook2?.Name as string) ?? null,
  }
}

// ⚠️ Custom field API names below are best-guess — verify against your SF schema
// if you get INVALID_FIELD errors on first run.
export async function fetchRenewals(year: string): Promise<SFRenewalOpp[]> {
  const conn = await getConn()
  const soql = `
    SELECT
      Id, Name, AccountId, Account.Name, Account.Open_Opps__c, OwnerId, Owner.Id, Owner.Name,
      Pricebook2.Name,
      StageName, CloseDate, Type, NextStep, CreatedDate, CurrencyIsoCode,
      Renewal_Date_1__c,
      ARR_Basis__c,
      Auto_Renewal_Amount__c,
      Booked_ARR__c,
      Net_ARR__c,
      Expansion_Status__c,
      Expansion_Notes__c,
      Renewal_Risk_Notes__c,
      Do_Not_Auto_Renew__c,
      Churn_Reason_External__c,
      Loss_Reason__c,
      Loss_Reason_Detail__c,
      Net_ARR_NZD__c,
      Booked_ARR_NZD__c,
      ARR_Basis_NZD__c,
      Auto_Renewal_Amount_NZD__c,
      Auto_Renewal_Net_ARR__c,
      Auto_Renewal_Net_ARR_NZD__c
    FROM Opportunity
    WHERE RecordTypeId = '0127F000001JcfYQAS'
      AND AccountId != '0017F00000XJtiAQAT'
      AND StageName != 'Closed - Duplicated'
      AND CloseDate >= ${year}-01-01
      AND CloseDate <= ${year}-12-31
    ORDER BY CloseDate ASC
  `
  const result = await conn.query<Record<string, unknown>>(soql)
  const allRecords: Record<string, unknown>[] = [...result.records]
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<Record<string, unknown>>(next.nextRecordsUrl)
    allRecords.push(...next.records)
  }
  return allRecords.map(mapRenewalRecord)
}

export async function fetchExpansions(year: string): Promise<SFExpansionOpp[]> {
  const conn = await getConn()
  const soql = `
    SELECT
      Id, Name, AccountId, Account.Name, Account.Open_Opps__c, OwnerId, Owner.Id, Owner.Name,
      Pricebook2.Name,
      StageName, CloseDate, Type, NextStep, CreatedDate,
      SaaSOptics_Contract_End_Date__c,
      ARR_Basis__c,
      Net_ARR__c,
      Category__c,
      Expansion_Notes__c,
      Do_Not_Auto_Renew__c,
      CurrencyIsoCode,
      Booked_ARR__c,
      Net_ARR_NZD__c,
      Booked_ARR_NZD__c,
      ARR_Basis_NZD__c
    FROM Opportunity
    WHERE RecordTypeId = '0127F000000fGpGQAU'
      AND AccountId != '0017F00000XJtiAQAT'
      AND StageName != 'Closed - Duplicated'
      AND CloseDate >= ${year}-01-01
      AND CloseDate <= ${year}-12-31
    ORDER BY CloseDate ASC
  `
  const result = await conn.query<Record<string, unknown>>(soql)
  const allRecords: Record<string, unknown>[] = [...result.records]
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<Record<string, unknown>>(next.nextRecordsUrl)
    allRecords.push(...next.records)
  }
  return allRecords.map(mapExpansionRecord)
}
