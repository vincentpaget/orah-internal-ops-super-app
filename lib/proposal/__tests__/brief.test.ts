import { describe, expect, it } from 'vitest'
import { generateBrief, type BriefInput } from '../brief'
import { addDays, addYears, monthRange, monthsBetween, schoolYearStartOnOrAfter } from '../dates'
import { money, unitMoney, yamlScalar } from '../format'
import { briefOnboardingName } from '../config'

const OPP_ID = '006Q9000018BijlIAC'
const OPP_NAME = 'Crescent School - Supervise - 11/11/2025'
const ONBOARDING = { product: 'Onboarding (Standard)', qty: 1, unitPrice: 6000 }
const SMS = { product: 'SMS Credits (6k)', qty: 4, unitPrice: 300 }

function acceptanceInput(overrides: Partial<BriefInput> = {}): BriefInput {
  return {
    currency: 'USD',
    lines: [
      { product: 'Supervise 3 (Elite)', qty: 500, unitPrice: 30 },
      { product: 'Dismissals', qty: 500, unitPrice: 6 },
    ],
    oneTimeFees: [ONBOARDING, SMS],
    oneTimeDiscountPct: { standard: 50, funded: 30 },
    schoolYearStart: '07-01',
    termYears: 2,
    startDate: '2026-11-01',
    include: { standard: true, funded: true },
    discountPct: { standard: 10, funded: 5 },
    schoolName: 'Crescent School',
    contactName: 'Natalie Vera',
    contactTitle: 'Director of Educational Technology & Innovation',
    repName: 'James Showers',
    repEmail: 'james@orah.com',
    opportunityId: OPP_ID,
    opportunityName: OPP_NAME,
    proposalDate: '2026-10-22',
    expiryDate: '2026-10-29',
    sis: 'Blackbaud',
    recommended: 'funded',
    rollout: {
      signByDate: '2026-10-29',
      kickoffDate: '2 Nov 2026',
      setupWindow: 'Nov to Dec',
      trainingWindow: 'Jan to Jun',
      notes: 'Technical integration first, then admin training. Pilot with a small group from April, then go live to the full school.',
      goLiveDate: '2027-07-01',
    },
    ...overrides,
  }
}

// Change request v2, acceptance test 1: must match exactly
const EXPECTED = `PROPOSAL BRIEF
proposal:
  school_name: Crescent School
  contact_name: Natalie Vera
  contact_title: Director of Educational Technology & Innovation
  rep_name: James Showers
  rep_email: james@orah.com
  salesforce_opportunity_id: 006Q9000018BijlIAC
  salesforce_opportunity_name: Crescent School - Supervise - 11/11/2025
  proposal_date: 22 October 2026
  expiry_date: 29 October 2026
  currency: USD
  school_year_start: 1 July
  contract_end: 30 June 2029
  sis: Blackbaud
  discount_policy_url: https://app.notion.com/p/3fb6511f93c781f4a4acd9aa8e628ad4
approval:
  status: within_policy
options:
  - letter: a
    type: standard
    start_or_access_date: 1 Nov 2026
    billing_starts: 1 Nov 2026
    paid_term: 32 months
    line_items:
      - {product: Supervise 3 (Elite), qty: 500, unit_price: $30.00, annual: $15,000}
      - {product: Dismissals, qty: 500, unit_price: $6.00, annual: $3,000}
    discount_pct: 10%
    discount_amount: $1,800
    annual: $16,200
    annual_saving: $900
    prorated_period: Nov–Jun
    one_time_fees:
      items:
        - {product: Onboarding (Standard), qty: 1, unit_price: $6,000.00, list: $6,000}
        - {product: SMS Credits (6k), qty: 4, unit_price: $300.00, list: $1,200}
      list: $7,200
      discount_pct: 50%
      discount_amount: $3,600
      total: $3,600
    due_at_signature: $14,400
    schedule:
      - {date: 1 July 2027, amount: $16,200}
      - {date: 1 July 2028, amount: $16,200}
  - letter: b
    type: funded
    start_or_access_date: 1 Nov 2026
    billing_starts: 1 Jul 2027
    paid_term: 24 months
    line_items:
      - {product: Supervise 3 (Elite), qty: 500, unit_price: $30.00, annual: $15,000}
      - {product: Dismissals, qty: 500, unit_price: $6.00, annual: $3,000}
    discount_pct: 5%
    discount_amount: $900
    annual: $17,100
    early_access_period: Nov–Jun
    one_time_fees:
      items:
        - {product: Onboarding (Standard), qty: 1, unit_price: $6,000.00, list: $6,000}
        - {product: SMS Credits (6k), qty: 4, unit_price: $300.00, list: $1,200}
      list: $7,200
      discount_pct: 30%
      discount_amount: $2,160
      total: $5,040
    due_at_signature: $5,040
    schedule:
      - {date: 1 July 2027, amount: $17,100}
      - {date: 1 July 2028, amount: $17,100}
rollout:
  sign_by: By 29 Oct 2026
  kickoff_date: 2 Nov 2026
  setup_window: Nov to Dec
  training_window: Jan to Jun
  notes: Technical integration first, then admin training. Pilot with a small group from April, then go live to the full school.
  go_live_date: 1 July 2027
  recommended_option: Option B · Set Up Now, Pay Later`

describe('PROPOSAL BRIEF', () => {
  it('1. reproduces the v2 example exactly', () => {
    const out = generateBrief(acceptanceInput())
    expect(out.missing).toEqual([])
    expect(out.canGenerate).toBe(true)
    const [std] = out.result.options
    expect(std.stub).toBe(10800)
    expect(std.dueAtSignature).toBe(3600 + 10800)
    expect(out.text).toBe(EXPECTED)
  })

  it('2. onboarding only: items has just the onboarding row', () => {
    const out = generateBrief(acceptanceInput({ oneTimeFees: [ONBOARDING] }))
    expect(out.text).toContain(
      '    one_time_fees:\n' +
      '      items:\n' +
      '        - {product: Onboarding (Standard), qty: 1, unit_price: $6,000.00, list: $6,000}\n' +
      '      list: $6,000\n' +
      '      discount_pct: 50%\n' +
      '      discount_amount: $3,000\n' +
      '      total: $3,000\n'
    )
    expect(out.text).not.toContain('SMS')
  })

  it('3. 0% one-time discount: discount $0, total = list', () => {
    const out = generateBrief(acceptanceInput({ oneTimeDiscountPct: { standard: 0, funded: 0 } }))
    expect(out.text).toContain('      list: $7,200\n      discount_pct: 0%\n      discount_amount: $0\n      total: $7,200\n')
    expect(out.result.options[1].dueAtSignature).toBe(7200)
  })

  it('4. one-time discount of 60%: needs approval and generation is blocked', () => {
    const out = generateBrief(acceptanceInput({ oneTimeDiscountPct: { standard: 50, funded: 60 } }))
    expect(out.policy.status).toBe('needs_approval')
    expect(out.policy.items).toEqual(['Option B one-time fees discount 60% exceeds the 50% limit'])
    expect(out.canGenerate).toBe(false)
    expect(out.text).toContain('approval:\n  status: needs_approval\n  items:\n    - Option B one-time fees discount 60% exceeds the 50% limit\noptions:')
  })

  it('5. Standard only, starting on the school year start', () => {
    const out = generateBrief(acceptanceInput({
      startDate: '2027-07-01',
      include: { standard: true, funded: false },
      rollout: { ...acceptanceInput().rollout, goLiveDate: '2027-07-01' },
    }))
    const [std] = out.result.options
    expect(out.result.options).toHaveLength(1)
    expect(std.stubMonths).toBe(0)
    expect(std.paidTermMonths).toBe(24)
    expect(std.dueAtSignature).toBe(3600)
    expect(out.result.defaultGoLive).toBe('2027-07-01')
    expect(out.text).not.toContain('prorated_period')
    expect(out.text).not.toContain('early_access_period')
    expect(out.text).not.toContain('annual_saving')
    expect(out.text).not.toContain('recommended_option')
    expect(out.text).toContain('    due_at_signature: $3,600\n')
    expect(out.text).toContain('  contract_end: 30 June 2029\n')
  })

  it('6. Funded only: early_access_period, no annual_saving or prorated_period', () => {
    const out = generateBrief(acceptanceInput({ include: { standard: false, funded: true } }))
    const [funded] = out.result.options
    expect(funded.type).toBe('funded')
    expect(funded.letter).toBe('a')
    expect(funded.dueAtSignature).toBe(5040)
    expect(out.text).toContain('    early_access_period: Nov–Jun\n')
    expect(out.text).not.toContain('annual_saving')
    expect(out.text).not.toContain('prorated_period')
    expect(out.text).not.toContain('recommended_option')
  })

  it('early access belongs to Funded, not Standard', () => {
    const out = generateBrief(acceptanceInput())
    const [std, funded] = out.result.options
    expect(std.earlyAccessPeriod).toBeUndefined()
    expect(std.proratedPeriod).toBe('Nov–Jun')
    expect(funded.proratedPeriod).toBeUndefined()
    expect(funded.earlyAccessPeriod).toBe('Nov–Jun')
  })

  it('Standard prorated_period runs from the start month to the month before the school year start', () => {
    const out = generateBrief(acceptanceInput({ startDate: '2027-01-01', include: { standard: true, funded: false } }))
    expect(out.result.options[0].proratedPeriod).toBe('Jan–Jun')
    expect(out.text).toContain('    prorated_period: Jan–Jun\n')
    expect(out.text).not.toContain('early_access_period')
  })

  it('3-year term: 3 schedule rows, Funded paid_term 36 months', () => {
    const out = generateBrief(acceptanceInput({ termYears: 3 }))
    const funded = out.result.options.find(o => o.type === 'funded')!
    const standard = out.result.options.find(o => o.type === 'standard')!
    expect(funded.schedule.map(r => r.date)).toEqual(['2027-07-01', '2028-07-01', '2029-07-01'])
    expect(standard.schedule).toHaveLength(3)
    expect(funded.paidTermMonths).toBe(36)
    expect(standard.paidTermMonths).toBe(44)
    expect(out.result.contractEnd).toBe('2030-06-30')
    expect(out.text).toContain('    paid_term: 36 months\n')
  })

  it('35% subscription discount needs approval and blocks generation', () => {
    const out = generateBrief(acceptanceInput({ discountPct: { standard: 35, funded: 5 } }))
    expect(out.policy.status).toBe('needs_approval')
    expect(out.policy.items).toEqual(['Option A subscription discount 35% exceeds the 30% limit'])
    expect(out.canGenerate).toBe(false)
  })

  it('one-time fees with a 0 quantity are dropped', () => {
    const out = generateBrief(acceptanceInput({ oneTimeFees: [ONBOARDING, { ...SMS, qty: 0 }] }))
    expect(out.result.options[0].oneTimeFees.lines).toEqual([ONBOARDING])
  })

  it('discount is on the sum of one-time fees, rounded to whole units', () => {
    const out = generateBrief(acceptanceInput({
      oneTimeFees: [{ product: 'Onboarding (Lite)', qty: 1, unitPrice: 2999 }, { product: 'SMS Credits (6k)', qty: 1, unitPrice: 333 }],
      oneTimeDiscountPct: { standard: 15, funded: 15 },
    }))
    // (2999 + 333) × 15% = 499.8 → 500
    expect(out.result.options[0].oneTimeFees).toMatchObject({ list: 3332, discountAmount: 500, total: 2832 })
  })

  it('onboarding names', () => {
    expect(briefOnboardingName('Onboarding Standard')).toBe('Onboarding (Standard)')
    expect(briefOnboardingName('Onboarding Premium')).toBe('Onboarding (Premium)')
    expect(briefOnboardingName('Custom setup')).toBe('Custom setup')
  })

  it('Funded is not allowed when the access date is on or after the school year start', () => {
    const out = generateBrief(acceptanceInput({ startDate: '2027-07-01' }))
    expect(out.result.fundedAllowed).toBe(false)
    expect(out.result.options.map(o => o.type)).toEqual(['standard'])
    expect(out.text).not.toContain('type: funded')

    expect(generateBrief(acceptanceInput({ startDate: '2027-06-01' })).result.fundedAllowed).toBe(true)
    // Per spec, the school year start rolls forward to the next one on/after the access date,
    // so an August start is "before" the following 1 July and Funded stays available.
    expect(generateBrief(acceptanceInput({ startDate: '2027-08-01' })).result.schoolYearStartDate).toBe('2028-07-01')
  })

  it('formats GBP', () => {
    const out = generateBrief(acceptanceInput({
      currency: 'GBP',
      lines: [{ product: 'Supervise 3 (Elite)', qty: 750, unitPrice: 23 }],
      oneTimeFees: [{ product: 'Onboarding (Standard)', qty: 1, unitPrice: 4500 }],
    }))
    expect(out.text).toContain('  currency: GBP\n')
    expect(out.text).toContain('{product: Supervise 3 (Elite), qty: 750, unit_price: £23.00, annual: £17,250}')
    expect(out.text).toContain('{product: Onboarding (Standard), qty: 1, unit_price: £4,500.00, list: £4,500}')
    expect(money(22500, 'GBP')).toBe('£22,500')
    expect(unitMoney(23, 'GBP')).toBe('£23.00')
  })

  it('other currency symbols', () => {
    expect(money(1234, 'CAD')).toBe('C$1,234')
    expect(money(1234, 'AUD')).toBe('A$1,234')
    expect(money(1234, 'NZD')).toBe('NZ$1,234')
    expect(money(1234, 'EUR')).toBe('€1,234')
  })

  it('omits contact_title and notes when empty, and reports missing fields', () => {
    const base = acceptanceInput()
    const out = generateBrief({ ...base, contactTitle: '', contactName: '', rollout: { ...base.rollout, notes: '' } })
    expect(out.text).not.toContain('contact_title')
    expect(out.text).not.toContain('notes:')
    expect(out.missing).toContain('Contact name')
    expect(out.canGenerate).toBe(false)
  })

  it('expiry must be within 30 days of the proposal date', () => {
    expect(generateBrief(acceptanceInput({ expiryDate: '2026-11-21' })).missing).toEqual([])
    const late = generateBrief(acceptanceInput({ expiryDate: '2026-11-22' }))
    expect(late.missing).toEqual(['Expiry date (within 30 days of the proposal date)'])
    expect(late.canGenerate).toBe(false)
  })

  it('sign-by can be later than the expiry date', () => {
    const base = acceptanceInput()
    const out = generateBrief({ ...base, rollout: { ...base.rollout, signByDate: '2026-11-15' } })
    expect(out.missing).toEqual([])
    expect(out.text).toContain('  expiry_date: 29 October 2026\n')
    expect(out.text).toContain('  sign_by: By 15 Nov 2026\n')

    const early = generateBrief({ ...base, rollout: { ...base.rollout, signByDate: '2026-10-01' } })
    expect(early.missing).toEqual(['Sign-by date (on or after the proposal date)'])
  })

  it('recommends Standard when chosen', () => {
    const out = generateBrief(acceptanceInput({ recommended: 'standard' }))
    expect(out.text).toContain('recommended_option: Option A · Get Started Now, Save Ongoing')
  })
})

describe('dates', () => {
  it('month maths', () => {
    expect(monthsBetween('2026-11-01', '2027-07-01')).toBe(8)
    expect(monthsBetween('2027-07-01', '2027-07-01')).toBe(0)
    expect(addDays(addYears('2027-07-01', 2), -1)).toBe('2029-06-30')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(schoolYearStartOnOrAfter('2026-11-01', '07-01')).toBe('2027-07-01')
    expect(schoolYearStartOnOrAfter('2027-07-01', '07-01')).toBe('2027-07-01')
    expect(schoolYearStartOnOrAfter('2026-11-01', '01-28')).toBe('2027-01-28')
    expect(monthRange('2026-11-01', '2027-07-01')).toBe('Nov–Jun')
  })
})

describe('yamlScalar', () => {
  it('quotes only when needed', () => {
    expect(yamlScalar('Plain text, fine')).toBe('Plain text, fine')
    expect(yamlScalar('Note: important')).toBe('"Note: important"')
    expect(yamlScalar('*starred')).toBe('"*starred"')
    expect(yamlScalar('$22,500', true)).toBe('$22,500')
    expect(yamlScalar('Foo, Bar', true)).toBe('"Foo, Bar"')
  })
})
