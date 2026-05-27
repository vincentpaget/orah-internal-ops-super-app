import type { SFRenewalOpp, SFExpansionOpp } from './types'

const WORKING_STAGES = new Set(['Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'])

export const OPEN_RENEWAL_STAGES = new Set(['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'])
export const OPEN_EXPANSION_STAGES = new Set(['Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'])

const EXPANSION_TYPES = new Set(['Upsell (Existing Students)', 'Cross Sell (New Students)'])

const VALID_RENEWAL_STAGES = new Set([
  'Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing',
  'Closed Won', 'Closed Lost', 'Closed Lost - Churned', 'Closed - Recycle',
])

const VALID_EXPANSION_STAGES = new Set([
  'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing',
  'Closed Won', 'Closed Lost', 'Closed - Recycle',
])

export interface HygieneRule {
  id: string
  label: string
  shortLabel: string
  description: string
  appliesTo: 'renewals' | 'expansions' | 'both'
}

export const HYGIENE_RULES: HygieneRule[] = [
  {
    id: 'type-empty',
    label: 'Type is empty',
    shortLabel: 'Type is empty',
    description: 'Opportunity is in an active stage (Qualifying → Closing) but Type is not set.',
    appliesTo: 'renewals',
  },
  {
    id: 'pending-with-type',
    label: 'Active opp in pending',
    shortLabel: 'Active opp in pending',
    description: 'Type is set on a Pending opportunity — it should be moved to a working stage.',
    appliesTo: 'renewals',
  },
  {
    id: 'expansion-amount-not-set',
    label: 'Expansion amount insufficient',
    shortLabel: 'Expansion amount insufficient',
    description: 'Upsell or Cross-sell opportunity where Net ARR is not at least $50 above the Auto Renewal Net ARR.',
    appliesTo: 'renewals',
  },
  {
    id: 'missing-expansion-notes',
    label: 'Expansion Notes is empty',
    shortLabel: 'Expansion Notes is empty',
    description: 'Active opportunity beyond Pending is missing Expansion Notes.',
    appliesTo: 'both',
  },
  {
    id: 'missing-next-steps',
    label: 'Next Step is empty',
    shortLabel: 'Next Step is empty',
    description: 'Active opportunity beyond Pending is missing a Next Step.',
    appliesTo: 'both',
  },
  {
    id: 'invalid-stage',
    label: 'Stage Invalid',
    shortLabel: 'Stage Invalid',
    description: 'Stage is not in the recognised stage list.',
    appliesTo: 'both',
  },
  {
    id: 'potential-duplicate',
    label: 'Potential Duplicate Opps Exist',
    shortLabel: 'Potential Duplicate Opps Exist',
    description: 'Account has more than one open opportunity — possible duplicate pipeline entry.',
    appliesTo: 'both',
  },
]

export const FLAG_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  HYGIENE_RULES.map(r => [r.id, r.shortLabel])
)

export function getRenewalFlags(opp: SFRenewalOpp): string[] {
  const flags: string[] = []

  if (WORKING_STAGES.has(opp.StageName) && !opp.Type) {
    flags.push('type-empty')
  }
  if (opp.StageName === 'Pending' && !!opp.Type) {
    flags.push('pending-with-type')
  }
  if (EXPANSION_TYPES.has(opp.Type ?? '')) {
    const autoRenewalNetArr = opp.Auto_Renewal_Net_ARR__c ?? 0
    if (opp.Net_ARR__c == null || opp.Net_ARR__c < autoRenewalNetArr + 50) {
      flags.push('expansion-amount-not-set')
    }
  }
  if (WORKING_STAGES.has(opp.StageName) && !opp.Expansion_Notes__c) {
    flags.push('missing-expansion-notes')
  }
  if (WORKING_STAGES.has(opp.StageName) && !opp.NextStep) {
    flags.push('missing-next-steps')
  }
  if (!VALID_RENEWAL_STAGES.has(opp.StageName)) {
    flags.push('invalid-stage')
  }
  if (OPEN_RENEWAL_STAGES.has(opp.StageName) && (opp['Account.Open_Opps__c'] ?? 0) > 1) {
    flags.push('potential-duplicate')
  }

  return flags
}

export function getExpansionFlags(opp: SFExpansionOpp): string[] {
  const flags: string[] = []

  if (WORKING_STAGES.has(opp.StageName) && !opp.Expansion_Notes__c) {
    flags.push('missing-expansion-notes')
  }
  if (WORKING_STAGES.has(opp.StageName) && !opp.NextStep) {
    flags.push('missing-next-steps')
  }
  if (!VALID_EXPANSION_STAGES.has(opp.StageName)) {
    flags.push('invalid-stage')
  }
  if (OPEN_EXPANSION_STAGES.has(opp.StageName) && (opp['Account.Open_Opps__c'] ?? 0) > 1) {
    flags.push('potential-duplicate')
  }

  return flags
}
