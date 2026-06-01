import type { SFOpportunity, Opportunity, SQLBucket, StageName } from './types'
import { SQO_STAGES, SAO_STAGES, STAGE_ORDER } from './types'

const KNOWN_STAGES = new Set<StageName>(STAGE_ORDER)

function startOfCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function computeSQOFlags(opp: SFOpportunity): string[] {
  const flags: string[] = []
  if (opp.Economic_Buyer__c === 'Red') flags.push('No economic buyer')
  if (opp.Compelling_Event__c === 'Red') flags.push('No compelling event')
  if (!opp.Net_ARR_NZD__c) flags.push('ARR not set')
  if (opp.CloseDate && opp.CloseDate < startOfCurrentMonth()) flags.push('Close date in past month')
  return flags
}

export function computeSAOFlags(opp: SFOpportunity): string[] {
  const flags: string[] = []
  if (opp.Compelling_Event__c === 'Red') flags.push('No compelling event')
  if (!opp.Re_engagement_Date__c) {
    flags.push('No re-engagement date')
  } else if (opp.CloseDate && opp.Re_engagement_Date__c > opp.CloseDate) {
    flags.push('Re-engagement after close date')
  }
  if (!opp.Nurturing_Reason__c) flags.push('No nurturing reason')
  if (opp.CloseDate && opp.CloseDate < startOfCurrentMonth()) flags.push('Close date in past month')
  return flags
}

export function computeSQLFlags(opp: SFOpportunity): string[] {
  const flags: string[] = []
  if (opp.CloseDate && opp.CloseDate < startOfCurrentMonth()) flags.push('Close date in past month')
  return flags
}

export function computeSQLBucket(opp: SFOpportunity): SQLBucket {
  const today = new Date().toISOString().slice(0, 10)
  if (opp.Next_Meeting_Date__c && opp.Next_Meeting_Date__c >= today) {
    return 'Demo Scheduled'
  }
  if (opp.Last_Meeting_Date__c) {
    return 'Demo Held - No Follow Up'
  }
  return 'No Demo'
}

export function computeLostFlags(opp: SFOpportunity): string[] {
  const flags: string[] = []
  if (!opp.Loss_Reason__c) flags.push('No loss reason')
  if (!opp.Loss_Reason_Detail__c) flags.push('No loss detail')
  if (!opp.Lost_From_Stage__c) flags.push('No loss stage')
  return flags
}

export function computeWonFlags(opp: SFOpportunity): string[] {
  const flags: string[] = []
  if (!opp.Alternatives_Considered__c) flags.push('No alternatives noted')
  if (!opp.Why_did_they_choose_us__c) flags.push('No win reason')
  if (!opp.What_can_we_do_to_repeat_this_outcome__c) flags.push('No repeat action')
  return flags
}

const CLOSED_LOST_SF_STAGES = new Set([
  'Closed Lost',
  'Closed - Recycle',
  'Closed - Qualified Out',
  'Closed - Disqualified',
])

export function enrichOpportunity(opp: SFOpportunity): Opportunity {
  const ageInDays = Math.floor((Date.now() - new Date(opp.CreatedDate).getTime()) / 86_400_000)

  const normalizedStage: StageName = CLOSED_LOST_SF_STAGES.has(opp.StageName as string)
    ? 'Closed Lost'
    : opp.StageName as StageName

  const normalized = { ...opp, StageName: normalizedStage }

  if (!KNOWN_STAGES.has(normalizedStage)) {
    return { ...normalized, flags: [], sqlBucket: null, ageInDays, unmapped: true }
  }

  let flags: string[] = []
  let sqlBucket: SQLBucket | null = null

  if (SQO_STAGES.includes(normalizedStage)) {
    flags = computeSQOFlags(opp)
  } else if (SAO_STAGES.includes(normalizedStage)) {
    flags = computeSAOFlags(opp)
  } else if (normalizedStage === 'Qualifying') {
    sqlBucket = computeSQLBucket(opp)
    flags = computeSQLFlags(opp)
  } else if (normalizedStage === 'Closed Lost') {
    flags = computeLostFlags(opp)
  } else if (normalizedStage === 'Closed Won') {
    flags = computeWonFlags(opp)
  }

  return { ...normalized, flags, sqlBucket, ageInDays }
}
