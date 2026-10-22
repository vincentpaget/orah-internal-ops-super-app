// Builds the PROPOSAL BRIEF YAML that reps paste into Claude. Key order, indentation
// and formatting are a contract with the proposal skill: change them together.

import { DISCOUNT_POLICY_URL, OFFER_LABELS, checkPolicy, type OfferType, type PolicyResult } from './config'
import { computeOffers, lineAnnual, type OfferInput, type OfferResult } from './calc'
import { addDays, formatDayMonth, formatLong, formatShort, isIsoDate } from './dates'
import { money, months, pct, unitMoney, yamlScalar } from './format'

export interface BriefInput extends OfferInput {
  schoolName: string
  contactName: string
  contactTitle: string
  repName: string
  repEmail: string
  opportunityId: string
  opportunityName: string
  proposalDate: string
  expiryDate: string
  sis: string
  recommended: OfferType
  rollout: {
    /** Date the school must accept the offer by. Defaults to the expiry date; can be later. */
    signByDate: string
    kickoffDate: string
    setupWindow: string
    trainingWindow: string
    notes: string
    goLiveDate: string
  }
}

export const EXPIRY_MAX_DAYS = 30

/** Missing or invalid required fields, as human-readable labels. Empty means OK. */
export function validateBrief(input: BriefInput, result: OfferResult): string[] {
  const missing: string[] = []
  const req = (v: string, label: string) => { if (!v.trim()) missing.push(label) }
  req(input.opportunityId, 'Salesforce opportunity')
  req(input.schoolName, 'School name')
  req(input.contactName, 'Contact name')
  req(input.repName, 'Rep name')
  req(input.repEmail, 'Rep email')
  req(input.sis, 'SIS')
  if (!isIsoDate(input.proposalDate)) missing.push('Proposal date')
  if (!isIsoDate(input.expiryDate)) missing.push('Expiry date')
  else if (isIsoDate(input.proposalDate) && (input.expiryDate < input.proposalDate || input.expiryDate > addDays(input.proposalDate, EXPIRY_MAX_DAYS))) {
    missing.push(`Expiry date (within ${EXPIRY_MAX_DAYS} days of the proposal date)`)
  }
  if (!isIsoDate(input.startDate)) missing.push('Start / access date')
  if (input.lines.length === 0) missing.push('Line items (configure the calculator)')
  if (input.oneTimeFees.length === 0) missing.push('Onboarding (configure the calculator)')
  if (result.options.length === 0) missing.push('At least one offer')
  req(input.rollout.kickoffDate, 'Onboarding kickoff date')
  req(input.rollout.setupWindow, 'Integration and setup window')
  req(input.rollout.trainingWindow, 'Training window')
  if (!isIsoDate(input.rollout.signByDate)) missing.push('Sign-by date')
  else if (isIsoDate(input.proposalDate) && input.rollout.signByDate < input.proposalDate) missing.push('Sign-by date (on or after the proposal date)')
  if (!isIsoDate(input.rollout.goLiveDate)) missing.push('Go-live date')
  return missing
}

export function policyFor(input: OfferInput, result: OfferResult): PolicyResult {
  return checkPolicy({
    offers: result.options.map(o => ({ letter: o.letter, discountPct: o.discountPct, oneTimeDiscountPct: o.oneTimeFees.discountPct })),
  })
}

export interface BriefOutcome {
  result: OfferResult
  policy: PolicyResult
  missing: string[]
  canGenerate: boolean
  text: string
}

/** Compute, check and render in one go: what the UI and tests use. */
export function generateBrief(input: BriefInput): BriefOutcome {
  const result = computeOffers(input)
  const policy = policyFor(input, result)
  const missing = validateBrief(input, result)
  return {
    result,
    policy,
    missing,
    canGenerate: missing.length === 0 && policy.status === 'within_policy',
    text: renderBrief(input, result, policy),
  }
}

export function renderBrief(input: BriefInput, result: OfferResult, policy: PolicyResult): string {
  const c = input.currency
  const m = (n: number) => money(n, c)
  const v = (s: string) => yamlScalar(s)
  const f = (s: string) => yamlScalar(s, true)
  const out: string[] = []
  const kv = (indent: number, key: string, value: string | undefined) => {
    if (value === undefined || value === '') return
    out.push(`${' '.repeat(indent)}${key}: ${value}`)
  }

  out.push('PROPOSAL BRIEF')
  out.push('proposal:')
  kv(2, 'school_name', v(input.schoolName))
  kv(2, 'contact_name', v(input.contactName))
  kv(2, 'contact_title', input.contactTitle.trim() ? v(input.contactTitle) : undefined)
  kv(2, 'rep_name', v(input.repName))
  kv(2, 'rep_email', v(input.repEmail))
  kv(2, 'salesforce_opportunity_id', v(input.opportunityId))
  kv(2, 'salesforce_opportunity_name', v(input.opportunityName))
  kv(2, 'proposal_date', formatLong(input.proposalDate))
  kv(2, 'expiry_date', formatLong(input.expiryDate))
  kv(2, 'currency', c)
  kv(2, 'school_year_start', formatDayMonth(input.schoolYearStart))
  kv(2, 'contract_end', formatLong(result.contractEnd))
  kv(2, 'sis', v(input.sis))
  kv(2, 'discount_policy_url', DISCOUNT_POLICY_URL)

  out.push('approval:')
  kv(2, 'status', policy.status)
  if (policy.items.length > 0) {
    out.push('  items:')
    for (const item of policy.items) out.push(`    - ${v(item)}`)
  }

  out.push('options:')
  for (const o of result.options) {
    out.push(`  - letter: ${o.letter}`)
    kv(4, 'type', o.type)
    kv(4, 'start_or_access_date', formatShort(o.startOrAccessDate))
    kv(4, 'billing_starts', formatShort(o.billingStarts))
    kv(4, 'paid_term', months(o.paidTermMonths))
    out.push('    line_items:')
    for (const l of input.lines) {
      out.push(`      - {product: ${f(l.product)}, qty: ${l.qty}, unit_price: ${unitMoney(l.unitPrice, c)}, annual: ${m(lineAnnual(l))}}`)
    }
    kv(4, 'discount_pct', pct(o.discountPct))
    kv(4, 'discount_amount', m(o.discountAmount))
    kv(4, 'annual', m(o.annual))
    kv(4, 'annual_saving', o.annualSaving !== undefined ? m(o.annualSaving) : undefined)
    kv(4, 'prorated_period', o.proratedPeriod)
    kv(4, 'early_access_period', o.earlyAccessPeriod)
    out.push('    one_time_fees:')
    out.push('      items:')
    for (const l of o.oneTimeFees.lines) {
      out.push(`        - {product: ${f(l.product)}, qty: ${l.qty}, unit_price: ${unitMoney(l.unitPrice, c)}, list: ${m(lineAnnual(l))}}`)
    }
    kv(6, 'list', m(o.oneTimeFees.list))
    kv(6, 'discount_pct', pct(o.oneTimeFees.discountPct))
    kv(6, 'discount_amount', m(o.oneTimeFees.discountAmount))
    kv(6, 'total', m(o.oneTimeFees.total))
    kv(4, 'due_at_signature', m(o.dueAtSignature))
    out.push('    schedule:')
    for (const r of o.schedule) {
      out.push(`      - {date: ${formatLong(r.date)}, amount: ${m(r.amount)}}`)
    }
  }

  out.push('rollout:')
  kv(2, 'sign_by', isIsoDate(input.rollout.signByDate) ? `By ${formatShort(input.rollout.signByDate)}` : undefined)
  kv(2, 'kickoff_date', v(input.rollout.kickoffDate))
  kv(2, 'setup_window', v(input.rollout.setupWindow))
  kv(2, 'training_window', v(input.rollout.trainingWindow))
  kv(2, 'notes', input.rollout.notes.trim() ? v(input.rollout.notes.trim()) : undefined)
  kv(2, 'go_live_date', isIsoDate(input.rollout.goLiveDate) ? formatLong(input.rollout.goLiveDate) : undefined)
  if (result.options.length > 1) {
    const rec = result.options.find(o => o.type === input.recommended) ?? result.options[0]
    kv(2, 'recommended_option', `Option ${rec.letter.toUpperCase()} · ${OFFER_LABELS[rec.type].tagline}`)
  }

  return out.join('\n')
}
