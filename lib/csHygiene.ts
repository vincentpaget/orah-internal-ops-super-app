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
    label: 'No Type Set',
    shortLabel: 'No Type',
    description: 'Opportunity is in an active stage (Qualifying → Closing) but Type is not set.',
    appliesTo: 'renewals',
  },
  {
    id: 'pending-with-type',
    label: 'Pending with Type Set',
    shortLabel: 'Pending + Type',
    description: 'Type is set on a Pending opportunity — it should be moved to a working stage.',
    appliesTo: 'renewals',
  },
  {
    id: 'expansion-amount-not-set',
    label: 'Expansion Amount Missing',
    shortLabel: 'Exp. Amount',
    description: 'Upsell or Cross-sell opportunity where Net ARR is below the Auto Renewal uplift delta.',
    appliesTo: 'renewals',
  },
  {
    id: 'missing-expansion-notes',
    label: 'Missing Expansion Notes',
    shortLabel: 'No Exp. Notes',
    description: 'Active opportunity beyond Pending is missing Expansion Notes.',
    appliesTo: 'both',
  },
  {
    id: 'missing-next-steps',
    label: 'Missing Next Step',
    shortLabel: 'No Next Step',
    description: 'Active opportunity beyond Pending is missing a Next Step.',
    appliesTo: 'both',
  },
  {
    id: 'invalid-stage',
    label: 'Invalid Stage',
    shortLabel: 'Invalid Stage',
    description: 'Stage is not in the recognised stage list.',
    appliesTo: 'both',
  },
  {
    id: 'potential-duplicate',
    label: 'Potential Duplicate',
    shortLabel: 'Duplicate',
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
    const delta = (opp.Auto_Renewal_Amount__c ?? 0) - (opp.ARR_Basis__c ?? 0)
    if (opp.Net_ARR__c == null || (delta > 0 && opp.Net_ARR__c < delta)) {
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
