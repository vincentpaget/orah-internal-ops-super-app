import type { Opportunity } from './types'

export interface RuleDefinition {
  label: string
  description: string
  // returns true if the opp FAILS this rule
  check: (opp: Opportunity) => boolean
}

export const SQO_RULES: RuleDefinition[] = [
  {
    label: 'Economic Buyer confirmed',
    description: 'EB grade must not be Red',
    check: (opp) => opp.Economic_Buyer__c === 'Red',
  },
  {
    label: 'Compelling Event identified',
    description: 'CE grade must not be Red',
    check: (opp) => opp.Compelling_Event__c === 'Red',
  },
  {
    label: 'ARR is set',
    description: 'Net ARR NZD must be populated',
    check: (opp) => !opp.Net_ARR_NZD__c,
  },
]

export const SAO_RULES: RuleDefinition[] = [
  {
    label: 'Compelling Event identified',
    description: 'CE grade must not be Red',
    check: (opp) => opp.Compelling_Event__c === 'Red',
  },
  {
    label: 'Re-engagement date set',
    description: 'Re-engagement date must be populated',
    check: (opp) => !opp.Re_engagement_Date__c,
  },
  {
    label: 'Re-engagement before close date',
    description: 'Re-engagement date must fall before the close date',
    check: (opp) =>
      !!(opp.Re_engagement_Date__c && opp.CloseDate && opp.Re_engagement_Date__c > opp.CloseDate),
  },
  {
    label: 'Nurturing reason documented',
    description: 'Nurturing reason field must be populated',
    check: (opp) => !opp.Nurturing_Reason__c,
  },
]

export const SQL_RULES: RuleDefinition[] = [
  {
    label: 'Next meeting scheduled',
    description: 'Must have a future Next Meeting Date',
    check: (opp) => opp.sqlBucket !== 'Demo Scheduled',
  },
]

export const WON_RULES: RuleDefinition[] = [
  {
    label: 'Alternatives considered',
    description: 'Alternatives Considered field must be populated',
    check: (opp) => !opp.Alternatives_Considered__c,
  },
  {
    label: 'Win reason documented',
    description: 'Why did they choose us field must be populated',
    check: (opp) => !opp.Why_did_they_choose_us__c,
  },
  {
    label: 'Repeat outcome noted',
    description: 'What can we do to repeat this outcome field must be populated',
    check: (opp) => !opp.What_can_we_do_to_repeat_this_outcome__c,
  },
]

export const LOST_RULES: RuleDefinition[] = [
  {
    label: 'Loss reason recorded',
    description: 'Loss Reason field must be populated',
    check: (opp) => !opp.Loss_Reason__c,
  },
  {
    label: 'Loss detail documented',
    description: 'Loss Reason Detail field must be populated',
    check: (opp) => !opp.Loss_Reason_Detail__c,
  },
  {
    label: 'Lost from stage recorded',
    description: 'Lost From Stage field must be populated',
    check: (opp) => !opp.Lost_From_Stage__c,
  },
]
