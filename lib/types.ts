export type TrafficLight = 'Red' | 'Yellow' | 'Green'

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export type StageName =
  | 'Qualifying'
  | 'Nurturing'
  | 'Evaluation'
  | 'Proposal'
  | 'Negotiation'
  | 'Closing'
  | 'Closed Won'
  | 'Closed Lost'

export const SQO_STAGES: StageName[] = ['Evaluation', 'Proposal', 'Negotiation', 'Closing']
export const SAO_STAGES: StageName[] = ['Nurturing']
export const SQL_STAGES: StageName[] = ['Qualifying']
export const OPEN_STAGES: StageName[] = ['Qualifying', 'Nurturing', 'Evaluation', 'Proposal', 'Negotiation', 'Closing']
export const CLOSED_STAGES: StageName[] = ['Closed Won', 'Closed Lost']

export const STAGE_ORDER: StageName[] = [
  'Qualifying',
  'Nurturing',
  'Evaluation',
  'Proposal',
  'Negotiation',
  'Closing',
  'Closed Won',
  'Closed Lost',
]

export const STAGE_DISPLAY: Record<StageName, string> = {
  Qualifying: 'Qualifying',
  Nurturing: 'Nurturing',
  Evaluation: 'Evaluation',
  Proposal: 'Proposal',
  Negotiation: 'Negotiation',
  Closing: 'Closing',
  'Closed Won': 'Closed Won',
  'Closed Lost': 'Closed Lost',
}

export const STAGE_FUNNEL: Record<StageName, string> = {
  Qualifying: 'SQL',
  Nurturing: 'SAO',
  Evaluation: 'SQO',
  Proposal: 'SQO',
  Negotiation: 'SQO',
  Closing: 'SQO',
  'Closed Won': 'Won',
  'Closed Lost': 'Lost',
}

export interface SFOpportunity {
  Id: string
  Name: string
  AccountId: string
  'Account.Name': string
  'Owner.Name': string
  'Owner.Id': string
  'Owner.Email'?: string | null
  StageName: StageName
  Net_ARR__c: number | null
  Net_ARR_NZD__c: number | null
  CloseDate: string
  Probability: number | null
  MEDDICC_Score__c: number | null
  Economic_Buyer__c: TrafficLight | null
  Economic_Buyer_Grade_Notes__c: string | null
  Compelling_Event__c: TrafficLight | null
  Compelling_Event_Grade_Notes__c: string | null
  Last_Meeting_Date__c: string | null
  Next_Meeting_Date__c: string | null
  Re_engagement_Date__c: string | null
  Nurturing_Reason__c: string | null
  NextStep: string | null
  CreatedDate: string
  Current_Stage_Duration__c: number | null
  Type?: string | null
  // Closed Lost hygiene fields
  Loss_Reason__c?: string | null
  Loss_Reason_Detail__c?: string | null
  Lost_From_Stage__c?: string | null
  // Closed Won hygiene fields
  Alternatives_Considered__c?: string | null
  Why_did_they_choose_us__c?: string | null
  What_can_we_do_to_repeat_this_outcome__c?: string | null
}

export type SQLBucket = 'Demo Scheduled' | 'Demo Held - No Follow Up' | 'No Demo'

export interface Opportunity extends SFOpportunity {
  flags: string[]
  sqlBucket: SQLBucket | null
  ageInDays: number
  unmapped?: true
}

export interface StageRow {
  stage: StageName
  count: number
  totalARR: number
}

export interface RepRow {
  repName: string
  repId: string
  pipelineARR: number
  openOpps: number
  flaggedCount: number
  healthPct: number
}

export interface MockUser {
  id: string
  name: string
  role: 'rep' | 'manager'
  salesforceId: string
}

export interface MockRepQuota {
  repId: string
  repName: string
  quota: number | null
}
