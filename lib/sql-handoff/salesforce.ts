import { Connection } from 'jsforce'
import type { SFSqlHandoffOpportunity, SFSqlDashboardRecord } from './types'

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

async function runQuery(soql: string): Promise<Record<string, unknown>[]> {
  const conn = await getConn()
  const result = await conn.query<Record<string, unknown>>(soql)
  const allRecords: Record<string, unknown>[] = [...result.records]
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<Record<string, unknown>>(next.nextRecordsUrl)
    allRecords.push(...next.records)
  }
  return allRecords
}

function mapOpportunity(r: Record<string, unknown>): SFSqlHandoffOpportunity {
  const owner = r.Owner as Record<string, unknown> | null
  const createdBy = r.CreatedBy as Record<string, unknown> | null
  return {
    ...(r as unknown as SFSqlHandoffOpportunity),
    'Owner.Name': (owner?.Name as string) ?? '',
    'CreatedBy.Name': (createdBy?.Name as string) ?? '',
  }
}

function mapDashboardRecord(r: Record<string, unknown>): SFSqlDashboardRecord {
  const owner = r.Owner as Record<string, unknown> | null
  return {
    ...(r as unknown as SFSqlDashboardRecord),
    'Owner.Name': (owner?.Name as string) ?? '',
  }
}

const MEDDICC_FIELD_LIST = `
  Metrics__c, Metrics_Grade_Reason__c, Metric_Notes__c,
  Economic_Buyer__c, Economic_Buyer_Grade_Notes__c, Economic_Buyer_Notes__c,
  Decision_Criteria__c, Decision_Criteria_Grade_Reason__c, Decision_Criteria_Notes__c,
  Decision_Process__c, Decision_Process_Grade_Reason__c, Decision_Process_Notes__c,
  Identified_Pain__c, Identified_Pain_Grade_Reason__c, Identified_Pain_Notes__c,
  Champion__c, Champion_Grade_Reason__c, Champion_Notes__c,
  Compelling_Event__c, Compelling_Event_Grade_Notes__c, Compelling_Event_Notes__c,
  Competition__c, Competition_Grade_Reason__c, Competition_Notes__c
`

export async function fetchSqlHandoffOpportunities(): Promise<SFSqlHandoffOpportunity[]> {
  const soql = `
    SELECT
      Id, Name, OwnerId, Owner.Name, CreatedById, CreatedBy.Name,
      StageName, SQL_Date__c, Initial_Meeting_Outcome__c, Initial_Meeting_FUp_Email_Status__c,
      Next_Meeting_Date__c, Last_Meeting_Date__c, LastActivityDate,
      NextStep, Discovery_Notes__c, AI_Last_Update__c, AI_Next_Steps__c, Manager_Review_Notes__c,
      Amount, CloseDate, Record_Type_Name__c,
      ${MEDDICC_FIELD_LIST}
    FROM Opportunity
    WHERE StageName = 'Qualifying'
    ORDER BY SQL_Date__c DESC
  `
  const records = await runQuery(soql)
  return records.map(mapOpportunity)
}

export async function fetchSqlDashboardHistory(quarterStart: string): Promise<SFSqlDashboardRecord[]> {
  const soql = `
    SELECT Id, OwnerId, Owner.Name, SQL_Date__c, SQO_Date__c, SQL_to_SQO_Days__c, Net_ARR_NZD__c
    FROM Opportunity
    WHERE SQL_Date__c >= ${quarterStart} OR SQO_Date__c >= ${quarterStart}
  `
  const records = await runQuery(soql)
  return records.map(mapDashboardRecord)
}

export async function updateOpportunityFields(id: string, fields: Record<string, unknown>): Promise<void> {
  const conn = await getConn()
  await conn.sobject('Opportunity').update({ Id: id, ...fields })
}
