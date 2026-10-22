import { describe, expect, it } from 'vitest'
import { calculateQuote, type QuoteInput } from '../../pricing/calc'
import { generateBrief, type BriefInput } from '../brief'
import { addDays } from '../dates'
import { parseBrief, type ParsedBrief } from '../parseBrief'
import { quoteToLines, quoteToOneTimeFees } from '../quoteToLines'

const TODAY = '2026-10-22'

const QUOTE_INPUT: QuoteInput = {
  platform: 'supervise',
  currency: 'USD',
  studentCount: 500,
  tierId: 'elite',
  addons: { dismissals: 500, nurture: 300 },
  oneTimeFees: { 'sms-6k': 4 },
}

function briefInput(q: QuoteInput, overrides: Partial<BriefInput> = {}): BriefInput {
  const quote = calculateQuote(q)!
  return {
    currency: q.currency,
    lines: quoteToLines(quote, q),
    oneTimeFees: quoteToOneTimeFees(quote),
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
    opportunityId: '006Q9000018BijlIAC',
    opportunityName: 'Crescent School - Supervise - 11/11/2025',
    proposalDate: '2026-10-22',
    expiryDate: '2026-10-29',
    sis: 'Blackbaud',
    recommended: 'funded',
    rollout: {
      signByDate: '2026-10-29',
      kickoffDate: '2 Nov 2026',
      setupWindow: 'Nov to Dec',
      trainingWindow: 'Jan to Jun',
      notes: 'Technical integration first: then admin training.',
      goLiveDate: '2027-07-01',
    },
    ...overrides,
  }
}

/** Rebuild a BriefInput from a parse, the way the UI does. */
function rebuild(p: ParsedBrief, proposalDate: string, expiryDate: string): BriefInput {
  const c = p.calculator
  const q: QuoteInput = { platform: c.platform, currency: c.currency, studentCount: c.studentCount, tierId: c.tierId, addons: c.addons, oneTimeFees: c.oneTimeFees }
  const quote = calculateQuote(q)!
  const d = p.details
  return {
    currency: c.currency,
    lines: quoteToLines(quote, q),
    oneTimeFees: quoteToOneTimeFees(quote),
    oneTimeDiscountPct: d.oneTimeDiscountPct,
    schoolYearStart: `${String(d.schoolYearMonth).padStart(2, '0')}-01`,
    termYears: d.termYears,
    startDate: d.startDate,
    include: d.include,
    discountPct: d.discountPct,
    schoolName: d.schoolName,
    contactName: d.contactName,
    contactTitle: d.contactTitle,
    repName: d.repName,
    repEmail: d.repEmail,
    opportunityId: d.opportunityId,
    opportunityName: d.opportunityName,
    proposalDate,
    expiryDate,
    sis: d.sis,
    recommended: d.recommended,
    rollout: {
      signByDate: d.signByDate ?? expiryDate,
      kickoffDate: d.kickoffDate ? '2 Nov 2026' : '',
      setupWindow: d.setupWindow,
      trainingWindow: d.trainingWindow,
      notes: d.notes,
      goLiveDate: d.goLiveDate ?? '2027-07-01',
    },
  }
}

describe('parseBrief', () => {
  it('reads calculator selections back from a generated brief', () => {
    const { text } = generateBrief(briefInput(QUOTE_INPUT))
    const p = parseBrief(text, TODAY)
    expect(p.warnings).toEqual([])
    expect(p.calculator).toEqual({
      platform: 'supervise',
      currency: 'USD',
      studentCount: 500,
      tierId: 'elite',
      addons: { dismissals: 500, nurture: 300 },
      oneTimeFees: { 'sms-6k': 4 },
    })
  })

  it('reads deal details back', () => {
    const { text } = generateBrief(briefInput(QUOTE_INPUT))
    const d = parseBrief(text, TODAY).details
    expect(d).toMatchObject({
      schoolName: 'Crescent School',
      contactTitle: 'Director of Educational Technology & Innovation',
      opportunityId: '006Q9000018BijlIAC',
      sis: 'Blackbaud',
      schoolYearMonth: 7,
      termYears: 2,
      startDate: '2026-11-01',
      include: { standard: true, funded: true },
      recommended: 'funded',
      discountPct: { standard: 10, funded: 5 },
      oneTimeDiscountPct: { standard: 50, funded: 30 },
      signByDate: null,
      kickoffDate: '2026-11-02',
      setupWindow: 'Nov to Dec',
      notes: 'Technical integration first: then admin training.',
      goLiveDate: null,
    })
  })

  it('round trip: rebuilding gives the same brief', () => {
    const original = briefInput(QUOTE_INPUT)
    const { text } = generateBrief(original)
    const again = generateBrief(rebuild(parseBrief(text, TODAY), original.proposalDate, original.expiryDate)).text
    expect(again).toBe(text)
  })

  it('round trip with new dates only changes the dates', () => {
    const original = briefInput(QUOTE_INPUT)
    const { text } = generateBrief(original)
    const again = generateBrief(rebuild(parseBrief(text, TODAY), '2026-11-05', addDays('2026-11-05', 7))).text
    const strip = (s: string) => s.split('\n').filter(l => !/proposal_date|expiry_date|sign_by/.test(l)).join('\n')
    expect(strip(again)).toBe(strip(text))
  })

  it('single standard option, boarding platform, other currency, explicit sign-by and go-live', () => {
    const q: QuoteInput = { platform: 'boarding', currency: 'GBP', studentCount: 300, tierId: 'core', addons: { openapi: 1 }, oneTimeFees: {} }
    const input = briefInput(q, {
      include: { standard: true, funded: false },
      termYears: 3,
      schoolYearStart: '09-01',
      rollout: { ...briefInput(q).rollout, signByDate: '2026-11-15', goLiveDate: '2027-01-01' },
    })
    const p = parseBrief(generateBrief(input).text, TODAY)
    expect(p.calculator).toMatchObject({ platform: 'boarding', currency: 'GBP', tierId: 'core', studentCount: 300, addons: { openapi: 1 }, oneTimeFees: {} })
    expect(p.details).toMatchObject({ include: { standard: true, funded: false }, termYears: 3, schoolYearMonth: 9, signByDate: '2026-11-15', goLiveDate: '2027-01-01' })
  })

  it('handles quoted values', () => {
    const { text } = generateBrief(briefInput(QUOTE_INPUT, { schoolName: 'St. Mary’s: Upper School', contactName: '"Nat" Vera' }))
    const d = parseBrief(text, TODAY).details
    expect(d.schoolName).toBe('St. Mary’s: Upper School')
    expect(d.contactName).toBe('"Nat" Vera')
  })

  it('warns about unknown products and changed prices', () => {
    let { text } = generateBrief(briefInput(QUOTE_INPUT))
    text = text
      .replaceAll('{product: Dismissals,', '{product: Retired Widget,')
      .replace(/(product: Supervise 3 \(Elite\), qty: 500, unit_price: )\$[\d.,]*\d/g, (_, prefix) => `${prefix}$1.00`)
    const p = parseBrief(text, TODAY)
    expect(p.calculator.addons).toEqual({ nurture: 300 })
    expect(p.warnings.join(' ')).toContain('Retired Widget')
    expect(p.warnings.join(' ')).toContain('List prices have changed')
  })

  it('warns when the old sign-by date has passed', () => {
    const { text } = generateBrief(briefInput(QUOTE_INPUT, { rollout: { ...briefInput(QUOTE_INPUT).rollout, signByDate: '2026-11-15' } }))
    const p = parseBrief(text, '2026-12-01')
    expect(p.details.signByDate).toBeNull()
    expect(p.warnings.join(' ')).toContain('sign-by')
  })

  it('rejects text that is not a brief', () => {
    expect(() => parseBrief('hello', TODAY)).toThrow(/PROPOSAL BRIEF/)
  })
})
