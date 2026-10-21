import { describe, expect, it } from 'vitest'
import { generateBrief, type BriefInput } from '../brief'
import { addDays, addYears, monthRange, monthsBetween, schoolYearStartOnOrAfter } from '../dates'
import { money, unitMoney, yamlScalar } from '../format'

const OPP_ID = '006XXXXXXXXXXXX'
const OPP_NAME = 'Loomis Chaffee - New Subscription'

function acceptanceInput(overrides: Partial<BriefInput> = {}): BriefInput {
  return {
    currency: 'USD',
    lines: [
      { product: 'Supervise 3 (Elite)', qty: 750, unitPrice: 30 },
      { product: 'Boarding Add-On', qty: 520, unitPrice: 5 },
      { product: 'Nurture', qty: 520, unitPrice: 6 },
    ],
    onboardingList: 5000,
    onboardingDiscountPct: { standard: 50, funded: 50 },
    schoolYearStart: '07-01',
    termYears: 2,
    startDate: '2026-11-01',
    include: { standard: true, funded: true },
    discountPct: { standard: 10, funded: 5 },
    schoolName: 'The Loomis Chaffee School',
    contactName: 'Chris Howes',
    contactTitle: 'Dean of Students',
    repName: 'James Showers',
    repEmail: 'james@orah.com',
    opportunityId: OPP_ID,
    opportunityName: OPP_NAME,
    proposalDate: '2026-10-21',
    expiryDate: '2026-10-31',
    sis: 'Veracross',
    recommended: 'funded',
    rollout: {
      signByDate: '2026-10-31',
      kickoffDate: 'Early Nov 2026',
      setupWindow: 'Nov–Dec 2026',
      trainingWindow: 'Jan–Jun 2027',
      notes: 'A pilot group tests it through spring term and summer school, then staff training.',
      goLiveDate: '2027-07-01',
    },
    ...overrides,
  }
}

const EXPECTED = `PROPOSAL BRIEF
proposal:
  school_name: The Loomis Chaffee School
  contact_name: Chris Howes
  contact_title: Dean of Students
  rep_name: James Showers
  rep_email: james@orah.com
  salesforce_opportunity_id: ${OPP_ID}
  salesforce_opportunity_name: ${OPP_NAME}
  proposal_date: 21 October 2026
  expiry_date: 31 October 2026
  currency: USD
  school_year_start: 1 July
  contract_end: 30 June 2029
  sis: Veracross
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
      - {product: Supervise 3 (Elite), qty: 750, unit_price: $30.00, annual: $22,500}
      - {product: Boarding Add-On, qty: 520, unit_price: $5.00, annual: $2,600}
      - {product: Nurture, qty: 520, unit_price: $6.00, annual: $3,120}
    discount_pct: 10%
    discount_amount: $2,822
    annual: $25,398
    annual_saving: $1,411
    prorated_period: Nov–Jun
    onboarding:
      list: $5,000
      discount_pct: 50%
      discount_amount: $2,500
      total: $2,500
    due_at_signature: $19,432
    schedule:
      - {date: 1 July 2027, amount: $25,398}
      - {date: 1 July 2028, amount: $25,398}
  - letter: b
    type: funded
    start_or_access_date: 1 Nov 2026
    billing_starts: 1 Jul 2027
    paid_term: 24 months
    line_items:
      - {product: Supervise 3 (Elite), qty: 750, unit_price: $30.00, annual: $22,500}
      - {product: Boarding Add-On, qty: 520, unit_price: $5.00, annual: $2,600}
      - {product: Nurture, qty: 520, unit_price: $6.00, annual: $3,120}
    discount_pct: 5%
    discount_amount: $1,411
    annual: $26,809
    early_access_period: Nov–Jun
    onboarding:
      list: $5,000
      discount_pct: 50%
      discount_amount: $2,500
      total: $2,500
    due_at_signature: $2,500
    schedule:
      - {date: 1 July 2027, amount: $26,809}
      - {date: 1 July 2028, amount: $26,809}
rollout:
  sign_by: By 31 Oct 2026
  kickoff_date: Early Nov 2026
  setup_window: Nov–Dec 2026
  training_window: Jan–Jun 2027
  notes: A pilot group tests it through spring term and summer school, then staff training.
  go_live_date: 1 July 2027
  recommended_option: Option B · Set Up Now, Pay Later`

describe('PROPOSAL BRIEF', () => {
  it('matches the acceptance output exactly', () => {
    const out = generateBrief(acceptanceInput())
    expect(out.missing).toEqual([])
    expect(out.canGenerate).toBe(true)
    expect(out.text).toBe(EXPECTED)
  })

  it('Standard only, starting on the school year start', () => {
    const out = generateBrief(acceptanceInput({
      startDate: '2027-07-01',
      include: { standard: true, funded: false },
      rollout: { ...acceptanceInput().rollout, goLiveDate: '2027-07-01' },
    }))
    const [std] = out.result.options
    expect(out.result.options).toHaveLength(1)
    expect(std.stubMonths).toBe(0)
    expect(std.earlyAccessPeriod).toBeUndefined()
    expect(std.proratedPeriod).toBeUndefined()
    expect(std.dueAtSignature).toBe(2500)
    expect(std.annualSaving).toBeUndefined()
    expect(std.paidTermMonths).toBe(24)
    expect(out.result.defaultGoLive).toBe('2027-07-01')
    expect(out.text).not.toContain('early_access_period')
    expect(out.text).not.toContain('prorated_period')
    expect(out.text).not.toContain('annual_saving')
    expect(out.text).not.toContain('recommended_option')
    expect(out.text).toContain('    due_at_signature: $2,500\n')
    expect(out.text).toContain('  contract_end: 30 June 2029\n')
  })

  it('early access belongs to Funded, not Standard', () => {
    const out = generateBrief(acceptanceInput())
    const [std, funded] = out.result.options
    expect(std.earlyAccessPeriod).toBeUndefined()
    expect(std.proratedPeriod).toBe('Nov–Jun')
    expect(std.stub).toBe(16932)
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
    expect(out.policy.items).toHaveLength(1)
    expect(out.policy.items[0]).toContain('35%')
    expect(out.canGenerate).toBe(false)
  })

  it('onboarding discount above 50% needs approval (per option)', () => {
    const out = generateBrief(acceptanceInput({ onboardingDiscountPct: { standard: 50, funded: 60 } }))
    expect(out.policy.status).toBe('needs_approval')
    expect(out.policy.items).toEqual(['Special Funded Offer Program onboarding discount 60% is above 50%'])
    expect(out.canGenerate).toBe(false)
  })

  it('each option carries its own onboarding discount', () => {
    const out = generateBrief(acceptanceInput({ onboardingDiscountPct: { standard: 20, funded: 50 } }))
    const [std, funded] = out.result.options
    expect(std.onboarding).toEqual({ list: 5000, discountPct: 20, discountAmount: 1000, total: 4000 })
    expect(funded.onboarding).toEqual({ list: 5000, discountPct: 50, discountAmount: 2500, total: 2500 })
    expect(std.dueAtSignature).toBe(4000 + 16932)
    expect(funded.dueAtSignature).toBe(2500)
    expect(out.text).toContain('      discount_pct: 20%\n      discount_amount: $1,000\n      total: $4,000\n    due_at_signature: $20,932')
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
      onboardingList: 4500,
    }))
    expect(out.text).toContain('  currency: GBP\n')
    expect(out.text).toContain('{product: Supervise 3 (Elite), qty: 750, unit_price: £23.00, annual: £17,250}')
    expect(out.text).toContain('      list: £4,500\n')
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
    expect(generateBrief(acceptanceInput({ expiryDate: '2026-11-20' })).missing).toEqual([])
    const late = generateBrief(acceptanceInput({ expiryDate: '2026-11-21' }))
    expect(late.missing).toEqual(['Expiry date (within 30 days of the proposal date)'])
    expect(late.canGenerate).toBe(false)
  })

  it('sign-by can be later than the expiry date', () => {
    const base = acceptanceInput()
    const out = generateBrief({ ...base, rollout: { ...base.rollout, signByDate: '2026-11-15' } })
    expect(out.missing).toEqual([])
    expect(out.text).toContain('  expiry_date: 31 October 2026\n')
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
