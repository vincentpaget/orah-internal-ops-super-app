import { Connection } from 'jsforce'
import type { SFOpportunity } from './types'

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
