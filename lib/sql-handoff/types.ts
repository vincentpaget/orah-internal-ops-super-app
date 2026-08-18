export const INITIAL_MEETING_OUTCOMES = [
  'No-show',
  'Held - interested',
  'Held - not interested',
  'Held - deferred',
  'Held - disqualified',
  'Held - other',
  'No call detected',
] as const

export type InitialMeetingOutcome = typeof INITIAL_MEETING_OUTCOMES[number]

export const FUP_OPTIONS = [
  'No sent',
  'Sent - generic fup',
  'Sent - recap no recording',
  'Sent - recap with recording',
] as const

export type FupStatus = typeof FUP_OPTIONS[number]

export type MeddiccGrade = 'Red' | 'Yellow' | 'Green'

// Loss_Reason__c options offered when closing as Disqualified — narrowed to the DQ-specific
// reasons (the "Lost -" reasons apply to Closed Lost, not this DQ flow). Labels match API values.
export const LOSS_REASONS: { label: string; value: string }[] = [
  { label: 'DQ - Not ICP', value: 'DQ - Not ICP' },
  { label: 'DQ - No Budget', value: 'DQ - No Budget' },
  { label: 'DQ - No Authority', value: 'DQ - No Authority' },
  { label: 'DQ - Unresponsive', value: 'DQ - Unresponsive' },
  { label: 'Other', value: 'Other' },
]

export type TabKey = 'all' | 'no-meeting' | 'scheduled' | 'outcome-required' | 'held'

export type WarningKey = 'step' | 'act' | 'meet' | 'age'

export type ModalKind = 'edit' | 'qualify' | 'nurture' | 'dq'

export type MeddiccKey = 'me' | 'eb' | 'dc' | 'dp' | 'ip' | 'ch' | 'ce' | 'co'

// Raw Opportunity shape for a currently-open Qualifying-stage SQL.
export interface SFSqlHandoffOpportunity {
  Id: string
  Name: string
  OwnerId: string
  'Owner.Name': string
  CreatedById: string
  'CreatedBy.Name': string
  StageName: string
  SQL_Date__c: string
  Initial_Meeting_Outcome__c: InitialMeetingOutcome | null
  Initial_Meeting_FUp_Email_Status__c: FupStatus | null
  Next_Meeting_Date__c: string | null
  Last_Meeting_Date__c: string | null
  LastActivityDate: string | null
  NextStep: string | null
  Discovery_Notes__c: string | null
  AI_Last_Update__c: string | null
  AI_Next_Steps__c: string | null
  Manager_Review_Notes__c: string | null
  Amount: number | null
  CloseDate: string | null
  Record_Type_Name__c: string | null

  Metrics__c: MeddiccGrade | null
  Metrics_Grade_Reason__c: string | null
  Metric_Notes__c: string | null
  Economic_Buyer__c: MeddiccGrade | null
  Economic_Buyer_Grade_Notes__c: string | null
  Economic_Buyer_Notes__c: string | null
  Decision_Criteria__c: MeddiccGrade | null
  Decision_Criteria_Grade_Reason__c: string | null
  Decision_Criteria_Notes__c: string | null
  Decision_Process__c: MeddiccGrade | null
  Decision_Process_Grade_Reason__c: string | null
  Decision_Process_Notes__c: string | null
  Identified_Pain__c: MeddiccGrade | null
  Identified_Pain_Grade_Reason__c: string | null
  Identified_Pain_Notes__c: string | null
  Champion__c: MeddiccGrade | null
  Champion_Grade_Reason__c: string | null
  Champion_Notes__c: string | null
  Compelling_Event__c: MeddiccGrade | null
  Compelling_Event_Grade_Notes__c: string | null
  Compelling_Event_Notes__c: string | null
  Competition__c: MeddiccGrade | null
  Competition_Grade_Reason__c: string | null
  Competition_Notes__c: string | null
}

// Lightweight historical record for the Dashboard's cohort/conversion metrics —
// spans opportunities that may have already moved past Qualifying.
export interface SFSqlDashboardRecord {
  Id: string
  OwnerId: string
  'Owner.Name': string
  SQL_Date__c: string | null
  SQO_Date__c: string | null
  SQL_to_SQO_Days__c: number | null
  Net_ARR_NZD__c: number | null
}

export interface WarningHit {
  key: WarningKey
  label: string
  detail: string
}

export interface MeddiccFormEntry {
  grade: MeddiccGrade
  notes: string
}

export interface ModalFormState {
  closeDate: string
  amount: string
  nextStep: string
  outcome: string
  fup: string
  reengage: string
  nurtureReason: string
  lossReasonLabel: string
  lossDetail: string
  managerReviewNotes: string
  discoveryNotes: string
  meddicc: Record<MeddiccKey, MeddiccFormEntry>
}

export interface ModalState {
  kind: ModalKind
  target: EnrichedOpportunity
  form: ModalFormState
}

// A single rendered field in the modal's Key Info grid — built per modal kind by
// buildModalFields() so the component can render generically instead of branching per kind.
export interface ModalFieldSpec {
  key: keyof ModalFormState | 'stage' | 'lastMeeting' | 'nextMeeting'
  label: string
  kind: 'text' | 'number' | 'date' | 'select' | 'area' | 'ro' | 'gap'
  value: string
  options?: string[]
  error?: string | null
  required?: boolean
  placeholder?: string
  span: number
}

export interface GradeGuideEntry {
  grade: MeddiccGrade
  text: string
}

export interface EnrichedOpportunity extends SFSqlHandoffOpportunity {
  age: number
  nextLabel: string
  lastMeetingLabel: string
  touched: string | null
  touchedDays: number | null
  touchedLabel: string
  warnKeys: WarningKey[]
  warnList: WarningHit[]
  warnCount: number
  sfUrl: string
}
