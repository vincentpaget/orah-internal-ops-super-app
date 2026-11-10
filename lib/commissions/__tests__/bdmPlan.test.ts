import { describe, expect, it } from 'vitest'
import { applyOnboardingRates, buildQuarterGroups, NEW_BUSINESS_RECORD_TYPE_ID, onlyCommissionableDeals } from '../calc'
import { buildPendingGroups } from '../pending'
import { arrInvoicedPaid, earnedShare, isCommissionLocked, isPartiallyPaid, onboardingEarnedShare, onboardingFeePaid, onboardingInvoicedPaid, onboardingPayableNow, onboardingPendingNow, payableNow, pendingNow, recordPaymentEdits, remainingCommission, remainingOnboardingCommission } from '../payments'
import { buildPayableGroups, buildPayRunHistory } from '../payable'
import type { CommissionBand, CompPlan, SFCommissionOpportunity } from '../types'
import { classifyInvoiceLine, summarizeInvoiceLines, type MaxioInvoiceLine } from '../maxio'

// BDM Schedule 2.0 bands (Oct 2026 – Jun 2027).
const BDM_BANDS: CommissionBand[] = [
  { key: '1', name: '1', emoji: '', max: 0.5, rate: 0.083 },
  { key: '2', name: '2', emoji: '', max: 0.75, rate: 0.142 },
  { key: '3', name: '3', emoji: '', max: 1.0, rate: 0.192 },
  { key: '4', name: '4', emoji: '', max: null, rate: 0.288 },
]

const plan = (quota: number, extra: Partial<CompPlan> = {}): CompPlan => ({ quota, bands: BDM_BANDS, expansionRate: 0.08, onboardingRate: 0.1, ...extra })

let n = 0
function deal(overrides: Partial<SFCommissionOpportunity> = {}): SFCommissionOpportunity {
  n += 1
  return {
    Id: `006000000000${String(n).padStart(3, '0')}`,
    Name: `Deal ${n}`,
    OwnerId: '005000000000001',
    'Owner.Name': 'Rep',
    recordOwnerName: 'Rep',
    RecordTypeId: NEW_BUSINESS_RECORD_TYPE_ID,
    'RecordType.Name': 'New Business',
    StageName: 'Closed Won',
    CloseDate: '2026-11-01',
    CurrencyIsoCode: 'NZD',
    Static_Currency_Conversion_Rate__c: 1,
    Net_ARR_Override__c: 0,
    Contract_Term_Length_Months__c: 12,
    Contract_Start_Date__c: null,
    Total_Invoice_Amount_Paid__c: null,
    Maxio_Next_Invoice_Date__c: null,
    Commission_Payout_Threshold__c: null,
    Commission_Payout_Threshold_Met__c: false,
    Commission_Amount_NZD__c: null,
    Commission_Paid__c: false,
    Commission_Paid_Amount_NZD__c: null,
    Commission_Paid_Date__c: null,
    Commission_Notes__c: null,
    onboardingFeeAmount: 0,
    maxioInvoices: null,
    calculatedOnboardingCommission: 0,
    Onboarding_Commission_Paid_Amount_NZD__c: null,
    Onboarding_Commission_Paid_Date__c: null,
    ...overrides,
  }
}

describe('BDM Schedule 2.0', () => {
  it('matches the §2 worked example: $120k against a $100k quota earns $18,260', () => {
    const [group] = buildQuarterGroups([deal({ Net_ARR_Override__c: 120000 })], { '2026-Q4': plan(100000) })
    expect(group.newBusinessCommission).toBeCloseTo(18260, 2)
  })

  it('pays a flat 10% on onboarding / PS fees, outside quota attainment', () => {
    const groups = buildQuarterGroups(
      [deal({ Net_ARR_Override__c: 50000, onboardingFeeAmount: 3000, CurrencyIsoCode: 'USD', Static_Currency_Conversion_Rate__c: 0.6 })],
      { '2026-Q4': plan(100000) }
    )
    const [group] = groups
    const [d] = group.deals
    expect(d.onboardingFeeNZD).toBeCloseTo(5000, 2)
    expect(d.onboardingCommission).toBeCloseTo(500, 2)
    expect(group.onboardingCommission).toBeCloseTo(500, 2)
    // Attainment is unaffected by the fee.
    expect(group.finalAttainment).toBeCloseTo(50000 / 0.6 / 100000, 6)
    expect(group.totalCommission).toBeCloseTo(group.newBusinessCommission + group.expansionCommission + 500, 2)
  })

  it('pays no onboarding commission for plans without an onboarding rate', () => {
    const [group] = buildQuarterGroups([deal({ Net_ARR_Override__c: 10000, onboardingFeeAmount: 2000 })], { '2026-Q4': plan(100000, { onboardingRate: null }) })
    expect(group.onboardingCommission).toBe(0)
    expect(group.deals[0].onboardingFeeNZD).toBe(2000)
  })

  it('§4.1 part-year first term: half paid leaves half remaining, then nets to zero', () => {
    const partPaid = deal({ Net_ARR_Override__c: 12000, Commission_Amount_NZD__c: 2304, Commission_Paid_Amount_NZD__c: 1152 })
    expect(isPartiallyPaid(partPaid)).toBe(true)
    expect(remainingCommission(partPaid)).toBeCloseTo(1152, 2)

    const fullyPaid = { ...partPaid, Commission_Paid_Amount_NZD__c: 2304 }
    expect(remainingCommission(fullyPaid)).toBe(0)
    expect(isPartiallyPaid(fullyPaid)).toBe(false)

    const ticked = { ...partPaid, Commission_Paid__c: true }
    expect(remainingCommission(ticked)).toBe(0)
  })

  it('locks a partially paid deal at its SF commission amount instead of recalculating it', () => {
    const partPaid = deal({ Net_ARR_Override__c: 12000, Commission_Amount_NZD__c: 2304, Commission_Paid_Amount_NZD__c: 1152 })
    expect(isCommissionLocked(partPaid)).toBe(true)
    const [group] = buildQuarterGroups([partPaid], { '2026-Q4': plan(100000) })
    expect(group.deals[0].calculatedCommission).toBe(2304)
  })

  it('tracks onboarding remaining separately and keeps owed deals in Payable', () => {
    const arrDoneOnboardingOwed = deal({
      Commission_Payout_Threshold_Met__c: true,
      Commission_Paid__c: true,
      Commission_Amount_NZD__c: 1000,
      Commission_Paid_Amount_NZD__c: 1000,
      onboardingFeeAmount: 3000,
      calculatedOnboardingCommission: 300,
    })
    expect(remainingOnboardingCommission(arrDoneOnboardingOwed)).toBe(300)
    // All-or-nothing: any recorded payout closes the onboarding commission out.
    expect(remainingOnboardingCommission({ ...arrDoneOnboardingOwed, Onboarding_Commission_Paid_Amount_NZD__c: 300 })).toBe(0)
    const allPaid = deal({ Commission_Payout_Threshold_Met__c: true, Commission_Paid__c: true, Commission_Amount_NZD__c: 500, Commission_Paid_Amount_NZD__c: 500 })

    const groups = buildPayableGroups([arrDoneOnboardingOwed, allPaid])
    expect(groups).toHaveLength(1)
    expect(groups[0].dealCount).toBe(1)
    expect(groups[0].totalCommissionAmountNZD).toBe(300)
  })
})

describe('clawbacks', () => {
  it('keeps a negative commission (contract reset) as a negative remaining amount, and in Payable', () => {
    const reset = deal({ Net_ARR_Override__c: -18270, Commission_Amount_NZD__c: -8908.47, Commission_Payout_Threshold_Met__c: true })
    expect(remainingCommission(reset)).toBeCloseTo(-8908.47, 2)
    const groups = buildPayableGroups([reset])
    expect(groups).toHaveLength(1)
    expect(groups[0].totalCommissionAmountNZD).toBeCloseTo(-8908.47, 2)
  })
})

describe('Westover: first invoice covers half the CARR plus the full onboarding fee', () => {
  const westover = () => deal({
    CurrencyIsoCode: 'USD', Static_Currency_Conversion_Rate__c: 0.57424,
    Net_ARR_Override__c: 7000, Commission_Payout_Threshold__c: 7000, Commission_Payout_Threshold_Met__c: false,
    Total_Invoice_Amount_Paid__c: 5500, onboardingFeeAmount: 2000,
    Commission_Amount_NZD__c: 3535.11,
  })

  it('takes the onboarding fee off the invoices paid, so 50% of the ARR commission is payable now', () => {
    const d = westover()
    expect(arrInvoicedPaid(d)).toBe(3500)
    expect(earnedShare(d)).toBe(0.5)
    expect(payableNow(d)).toBeCloseTo(1767.56, 1)
    expect(pendingNow(d)).toBeCloseTo(1767.56, 1)
  })

  it('treats the onboarding fee as fully paid, so 100% of onboarding commission is payable now', () => {
    const d = westover()
    expect(onboardingFeePaid(d)).toBe(true)
    expect(onboardingPayableNow({ ...d, calculatedOnboardingCommission: 348.29 })).toBeCloseTo(348.29, 2)
  })

  it('Record payment moves Paid to Date to the earned amount and leaves the rest pending', () => {
    const d = { ...westover(), calculatedOnboardingCommission: 348.29 }
    const e = recordPaymentEdits(d, undefined, true)
    expect(e.commissionPaidAmount).toBeCloseTo(1767.56, 1)
    expect(e.commissionPaid).toBe(false)
    expect(e.onboardingCommissionPaidAmount).toBeCloseTo(348.29, 2)
    expect(e.onboardingCommissionPaidDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const after = { ...d, Commission_Paid_Amount_NZD__c: e.commissionPaidAmount! }
    expect(payableNow(after)).toBe(0)
    expect(pendingNow(after)).toBeCloseTo(1767.55, 1)
    // Once the next invoice lands, the rest becomes payable and Record payment closes the deal out.
    const fullyInvoiced = { ...after, Total_Invoice_Amount_Paid__c: 9000 }
    expect(payableNow(fullyInvoiced)).toBeCloseTo(1767.55, 1)
    expect(recordPaymentEdits(fullyInvoiced).commissionPaid).toBe(true)
  })
})

describe('Maxio invoice lines (Westover, as synced from Maxio)', () => {
  const line = (itemCode: string, amount: number, invoiceStatus: string, invoiceNumber: string): MaxioInvoiceLine => ({
    opportunityId: '006Q900001OGnGAIA1', invoiceNumber, invoiceDate: null, invoiceStatus, itemCode, itemName: null, amount,
  })
  const westoverLines = [
    line('SP_Supervise3_24Q3', 3000, 'Paid', 'MX-11122'),
    line('SA_Boarding_26Q1', 500, 'Paid', 'MX-11122'),
    line('PS_OnboardingStandard_26Q1', 2000, 'Paid', 'MX-11122'),
    line('SP_Supervise3_24Q3', 6000, 'Future (Not Sent)', 'MX-11123'),
    line('SA_Boarding_26Q1', 1000, 'Future (Not Sent)', 'MX-11123'),
  ]

  it('classifies item codes: PS_ is onboarding; SMS, hardware and credits are excluded; the rest is ARR', () => {
    expect(classifyInvoiceLine('PS_OnbFoundation_24Q3')).toBe('onboarding')
    expect(classifyInvoiceLine('PAYG_SMS15_24Q3')).toBe('excluded')
    expect(classifyInvoiceLine('HW_NFC10_24Q3')).toBe('excluded')
    expect(classifyInvoiceLine('nr_credit')).toBe('excluded')
    expect(classifyInvoiceLine('SP_Supervise3_24Q3')).toBe('arr')
    expect(classifyInvoiceLine('supervise | elite')).toBe('arr')
  })

  it('counts only Paid invoices, and splits ARR from the onboarding fee', () => {
    const s = summarizeInvoiceLines(westoverLines)
    expect(s).toMatchObject({ arrPaid: 3500, arrInvoiced: 10500, onboardingInvoiced: 2000, onboardingPaid: 2000 })
  })

  it('gives the same 50% / 100% split from the real invoice lines', () => {
    const maxioInvoices = summarizeInvoiceLines(westoverLines)
    const d = deal({
      Net_ARR_Override__c: 7000, Commission_Amount_NZD__c: 3535.11, Total_Invoice_Amount_Paid__c: 5500,
      onboardingFeeAmount: maxioInvoices.onboardingInvoiced, maxioInvoices,
    })
    expect(arrInvoicedPaid(d)).toBe(3500)
    expect(earnedShare(d)).toBe(0.5)
    expect(onboardingFeePaid(d)).toBe(true)
  })

  it('does not count an unpaid onboarding line as paid, even if the invoice total would cover it', () => {
    const maxioInvoices = summarizeInvoiceLines([
      line('SP_Supervise3_24Q3', 3500, 'Paid', 'MX-1'),
      line('PS_OnboardingStandard_26Q1', 2000, 'Past Due', 'MX-2'),
    ])
    const d = deal({ Net_ARR_Override__c: 7000, Total_Invoice_Amount_Paid__c: 3500, onboardingFeeAmount: 2000, maxioInvoices })
    expect(onboardingFeePaid(d)).toBe(false)
    expect(earnedShare(d)).toBe(0.5)
  })

  it('ignores a met payout threshold when Maxio shows less ARR paid', () => {
    const maxioInvoices = summarizeInvoiceLines([line('SP_Supervise3_24Q3', 3500, 'Paid', 'MX-1'), line('PS_OnboardingStandard_26Q1', 3500, 'Paid', 'MX-1')])
    const d = deal({ Net_ARR_Override__c: 7000, Commission_Payout_Threshold_Met__c: true, maxioInvoices })
    expect(earnedShare(d)).toBe(0.5)
  })
})

describe('onboarding paid (all-or-nothing), from Maxio invoice lines', () => {
  const line = (itemCode: string, amount: number, invoiceStatus: string): MaxioInvoiceLine => ({
    opportunityId: '006000000000999', invoiceNumber: null, invoiceDate: null, invoiceStatus, itemCode, itemName: null, amount,
  })

  it('Westover: the $2,000 fee is fully paid, so all of the onboarding commission is payable', () => {
    const maxioInvoices = summarizeInvoiceLines([line('SP_Supervise3_24Q3', 3500, 'Paid'), line('PS_OnboardingStandard_26Q1', 2000, 'Paid')])
    const d = deal({ Net_ARR_Override__c: 7000, onboardingFeeAmount: 2000, maxioInvoices })
    expect(onboardingInvoicedPaid(d)).toBe(2000)
    expect(onboardingEarnedShare(d)).toBe(1)
    expect(onboardingPayableNow({ ...d, calculatedOnboardingCommission: 348.29 })).toBeCloseTo(348.29, 2)
    expect(onboardingPendingNow({ ...d, calculatedOnboardingCommission: 348.29 })).toBe(0)
  })

  it('is all-or-nothing: a fee split across invoices pays nothing until every part is paid', () => {
    const half = summarizeInvoiceLines([line('PS_OnboardingPremium_26Q1', 1500, 'Paid'), line('PS_OnboardingPremium_26Q1', 1500, 'Future (Not Sent)')])
    const d = deal({ Net_ARR_Override__c: 10000, onboardingFeeAmount: 3000, maxioInvoices: half })
    expect(onboardingInvoicedPaid(d)).toBe(1500)
    expect(onboardingEarnedShare(d)).toBe(0)
    expect(onboardingPayableNow({ ...d, calculatedOnboardingCommission: 300 })).toBe(0)
    expect(onboardingPendingNow({ ...d, calculatedOnboardingCommission: 300 })).toBeCloseTo(300, 2)

    const all = summarizeInvoiceLines([line('PS_OnboardingPremium_26Q1', 1500, 'Paid'), line('PS_OnboardingPremium_26Q1', 1500, 'Paid')])
    const paid = { ...d, maxioInvoices: all }
    expect(onboardingEarnedShare(paid)).toBe(1)
    expect(onboardingPayableNow({ ...paid, calculatedOnboardingCommission: 300 })).toBeCloseTo(300, 2)
  })

  it('pays nothing while the onboarding invoice is unpaid', () => {
    const maxioInvoices = summarizeInvoiceLines([line('PS_OnboardingStandard_26Q1', 2000, 'Past Due')])
    const d = deal({ Net_ARR_Override__c: 7000, onboardingFeeAmount: 2000, maxioInvoices })
    expect(onboardingInvoicedPaid(d)).toBe(0)
    expect(onboardingPayableNow({ ...d, calculatedOnboardingCommission: 200 })).toBe(0)
    expect(onboardingPendingNow({ ...d, calculatedOnboardingCommission: 200 })).toBeCloseTo(200, 2)
  })
})

describe('onboarding commission is calculated from the rep plan, not stored in SF', () => {
  it('applies the rep onboarding rate for the deal close quarter', () => {
    const d = deal({ 'Owner.Name': 'James Showers', CloseDate: '2026-11-15', onboardingFeeAmount: 2000, CurrencyIsoCode: 'USD', Static_Currency_Conversion_Rate__c: 0.5 })
    const settings = { 'James Showers::2026-Q4': plan(251000, { onboardingRate: 0.1 }), 'James Showers::2027-Q1': plan(335000, { onboardingRate: null }) }
    const [withRate] = applyOnboardingRates([d], settings)
    expect(withRate.calculatedOnboardingCommission).toBeCloseTo(400, 2) // $2,000 USD ÷ 0.5 = $4,000 NZD × 10%
    const [noRate] = applyOnboardingRates([{ ...d, CloseDate: '2027-02-01' }], settings)
    expect(noRate.calculatedOnboardingCommission).toBe(0)
  })

  it('splits pay-run history into ARR and onboarding payouts on their own paid dates', () => {
    const d = deal({
      Commission_Paid__c: true, Commission_Paid_Amount_NZD__c: 1000, Commission_Paid_Date__c: '2026-12-20',
      Onboarding_Commission_Paid_Amount_NZD__c: 300, Onboarding_Commission_Paid_Date__c: '2027-01-15',
    })
    const runs = buildPayRunHistory([d])
    expect(runs.map(r => [r.monthKey, r.totalPaidNZD])).toEqual([['2027-01', 300], ['2026-12', 1000]])
  })
})

describe('separate ARR and onboarding tables in Payable / Pending', () => {
  const paidLines = summarizeInvoiceLines([
    { opportunityId: 'x', invoiceNumber: null, invoiceDate: null, invoiceStatus: 'Paid', itemCode: 'SP_Supervise3_24Q3', itemName: null, amount: 3500 },
    { opportunityId: 'x', invoiceNumber: null, invoiceDate: null, invoiceStatus: 'Paid', itemCode: 'PS_OnboardingStandard_26Q1', itemName: null, amount: 2000 },
  ])

  it('puts a Westover-style deal in both payable tables, each under its own paid-date month', () => {
    const d = deal({
      Net_ARR_Override__c: 7000, Commission_Amount_NZD__c: 3535.11, maxioInvoices: paidLines,
      onboardingFeeAmount: 2000, calculatedOnboardingCommission: 348.29,
      Commission_Paid_Date__c: '2026-12-15', Onboarding_Commission_Paid_Date__c: null,
    })
    const [rep] = buildPayableGroups([d])
    expect(rep.dealCount).toBe(1)
    expect(rep.months.map(m => [m.monthKey, m.arrDeals.length, m.onboardingDeals.length])).toEqual([['2026-12', 1, 0], ['unscheduled', 0, 1]])
    expect(rep.totalCommissionAmountNZD).toBeCloseTo(1767.56 + 348.29, 1)
  })

  it('lists onboarding still awaiting payment in Pending even when the ARR is already paid', () => {
    const unpaidFee = summarizeInvoiceLines([
      { opportunityId: 'x', invoiceNumber: null, invoiceDate: null, invoiceStatus: 'Paid', itemCode: 'SP_Supervise3_24Q3', itemName: null, amount: 7000 },
      { opportunityId: 'x', invoiceNumber: null, invoiceDate: null, invoiceStatus: 'Past Due', itemCode: 'PS_OnboardingStandard_26Q1', itemName: null, amount: 2000 },
    ])
    const d = deal({
      Commission_Payout_Threshold_Met__c: true, Commission_Paid__c: true, Commission_Amount_NZD__c: 1000, Commission_Paid_Amount_NZD__c: 1000,
      maxioInvoices: unpaidFee, onboardingFeeAmount: 2000, calculatedOnboardingCommission: 348.29,
    })
    const [rep] = buildPendingGroups([d])
    expect(rep.deals).toHaveLength(0)
    expect(rep.onboardingDeals).toHaveLength(1)
  })

  it('leaves out reps with no comp plan for the close quarter', () => {
    const settings = { 'James Showers::2026-Q4': plan(251000) }
    const deals = [deal({ 'Owner.Name': 'James Showers', CloseDate: '2026-11-01' }), deal({ 'Owner.Name': 'Emily DeRoche', CloseDate: '2026-11-01' })]
    expect(onlyCommissionableDeals(deals, settings).map(d => d['Owner.Name'])).toEqual(['James Showers'])
  })
})

describe('0% expansion rate', () => {
  const expansion = (o: Partial<SFCommissionOpportunity> = {}) =>
    deal({ RecordTypeId: '0120000000EXPAN', 'RecordType.Name': 'Expansion', Net_ARR_Override__c: 10000, ...o })

  it('leaves expansion deals out of the Rep Summary quarter', () => {
    const [group] = buildQuarterGroups(
      [deal({ Net_ARR_Override__c: 50000 }), expansion()],
      { '2026-Q4': plan(100000, { expansionRate: 0 }) }
    )
    expect(group.deals).toHaveLength(1)
    expect(group.expansionAmount).toBe(0)
    expect(group.totalAmount).toBe(50000)
  })

  it('still shows expansions when the flat rate is above 0%', () => {
    const [group] = buildQuarterGroups([expansion()], { '2026-Q4': plan(100000, { expansionRate: 0.08 }) })
    expect(group.deals).toHaveLength(1)
    expect(group.expansionCommission).toBeCloseTo(800, 2)
  })

  it('leaves them out of Pending / Payable too, but keeps new business', () => {
    const settings = { 'Rep::2026-Q4': plan(100000, { expansionRate: 0 }) }
    const kept = onlyCommissionableDeals([deal(), expansion()], settings)
    expect(kept.map(d => d['RecordType.Name'])).toEqual(['New Business'])
  })
})
