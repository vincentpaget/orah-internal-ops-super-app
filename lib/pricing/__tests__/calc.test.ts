import { describe, expect, it } from 'vitest'
import { calculateQuote, quoteToText } from '../calc'

describe('one-time fees', () => {
  const base = { platform: 'supervise' as const, currency: 'USD' as const, studentCount: 500, tierId: 'pro', addons: {} }

  it('adds selected packs to Year 1, not to annual', () => {
    const q = calculateQuote({ ...base, oneTimeFees: { 'sms-15k': 2, 'nfc-tiles-10': 3 } })!
    expect(q.oneTimeLines).toEqual([
      { name: 'SMS Credits (15k)', quantity: 2, unitPrice: 700, cost: 1400 },
      { name: 'NFC Checkpoint Tiles (10 Pack)', quantity: 3, unitPrice: 100, cost: 300 },
    ])
    expect(q.oneTimeTotal).toBe(1700)
    expect(q.annual).toBe(500 * 23)
    expect(q.year1).toBe(500 * 23 + 3000 + 1700)
  })

  it('uses the currency price list', () => {
    const q = calculateQuote({ ...base, currency: 'NZD', oneTimeFees: { 'sms-6k': 1, 'sms-30k': 1 } })!
    expect(q.oneTimeLines.map(l => l.unitPrice)).toEqual([495, 2310])
    const gbp = calculateQuote({ ...base, currency: 'GBP', oneTimeFees: { 'sms-30k': 1 } })!
    expect(gbp.oneTimeTotal).toBe(1050)
  })

  it('is unchanged when none are selected', () => {
    const q = calculateQuote(base)!
    expect(q.oneTimeLines).toEqual([])
    expect(q.year1).toBe(q.annual + q.onboardingFee)
    expect(quoteToText(q, base)).not.toContain('Additional One-time Fees')
  })

  it('lists them in the copied text', () => {
    const input = { ...base, oneTimeFees: { 'sms-6k': 1 } }
    expect(quoteToText(calculateQuote(input)!, input)).toContain('  - SMS Credits (6k): 1 × $300 = $300\n')
  })
})
