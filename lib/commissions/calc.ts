import type { CommissionBand, CommissionDeal, QuarterCommissionGroup, SFCommissionOpportunity } from './types'
import { toNZD } from './currency'
import { quarterKeyForDate, quarterLabel } from './quarters'

export const DEFAULT_QUOTA = 50000

export const DEFAULT_BANDS: CommissionBand[] = [
  { key: '1', name: '1', emoji: '', max: 0.50,     rate: 0.2245 },
  { key: '2', name: '2', emoji: '', max: 0.75,     rate: 0.3368 },
  { key: '3', name: '3', emoji: '', max: 1.00,     rate: 0.449 },
  { key: '4', name: '4', emoji: '', max: null, rate: 0.6735 },
]

function tierOf(deal: SFCommissionOpportunity): number {
  if (deal.Commission_Paid__c) return 0
  if (deal.Commission_Payout_Threshold_Met__c) return 1
  return 2
}

/** The real, already-locked effective rate for a paid or threshold-met deal — independent of processing order. */
function lockedCommissionRate(deal: SFCommissionOpportunity): number {
  const amountNZD = toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c)
  return amountNZD !== 0 ? (deal.Commission_Amount_NZD__c ?? 0) / amountNZD : 0
}

/**
 * Paid deals first, then deals that have met their payout threshold, then
 * everything else. This is the order the cumulative-attainment walk itself
 * processes deals in (not just a display sort): paid/threshold-met revenue
 * claims quota capacity ahead of deals that are still just estimates.
 *
 * Within the paid and threshold-met tiers, order by commission rate ascending
 * — since that rate is locked and order-independent, this shows the steady
 * rate progression (and the calculation order) rather than an arbitrary
 * close-date ordering. The "everything else" tier still orders by Close Date.
 */
function compareDealsForCommission(a: SFCommissionOpportunity, b: SFCommissionOpportunity): number {
  const ta = tierOf(a)
  const tb = tierOf(b)
  if (ta !== tb) return ta - tb
  if (ta === 0 || ta === 1) {
    const rateDiff = lockedCommissionRate(a) - lockedCommissionRate(b)
    if (rateDiff !== 0) return rateDiff
  }
  return a.CloseDate.localeCompare(b.CloseDate)
}

export function bandForAttainment(pct: number, bands: CommissionBand[]): CommissionBand {
  for (const band of bands) {
    if (band.max === null || pct <= band.max) return band
  }
  return bands[bands.length - 1]
}

/**
 * Splits `dealAmount` across whichever band(s) the cumulative-attainment range
 * [priorAmount/quota, (priorAmount+dealAmount)/quota] crosses, weighting each
 * band's rate by how much of that range falls inside it.
 */
export function marginalCommission(
  priorAmount: number,
  dealAmount: number,
  quota: number,
  bands: CommissionBand[]
): { commission: number; newCumulativeAmount: number } {
  const newCumulativeAmount = priorAmount + dealAmount

  if (quota <= 0) {
    const topRate = bands[bands.length - 1].rate
    return { commission: dealAmount * topRate, newCumulativeAmount }
  }

  const lo = priorAmount / quota
  const hi = newCumulativeAmount / quota
  if (lo === hi) return { commission: 0, newCumulativeAmount }

  const rangeLo = Math.min(lo, hi)
  const rangeHi = Math.max(lo, hi)
  const rangeLen = rangeHi - rangeLo

  let weightedRateSum = 0
  let bandLo = 0
  for (const band of bands) {
    const bandMax = band.max === null ? Infinity : band.max
    const overlapLo = Math.max(rangeLo, bandLo)
    const overlapHi = Math.min(rangeHi, bandMax)
    if (overlapHi > overlapLo) {
      weightedRateSum += band.rate * (overlapHi - overlapLo)
    }
    bandLo = bandMax
  }

  const avgRate = weightedRateSum / rangeLen
  return { commission: dealAmount * avgRate, newCumulativeAmount }
}

/** `deals` must already be sorted by CloseDate ascending for a single Owner. */
export function applyCommissions(deals: SFCommissionOpportunity[], quota: number, bands: CommissionBand[]): CommissionDeal[] {
  let cumulative = 0
  return deals.map(deal => {
    const amountNZD = toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c)
    const attainmentBefore = quota > 0 ? cumulative / quota : 0
    const { commission, newCumulativeAmount } = marginalCommission(cumulative, amountNZD, quota, bands)
    cumulative = newCumulativeAmount
    const attainmentAfter = quota > 0 ? cumulative / quota : 0
    const isPaid = deal.Commission_Paid__c === true
    const calculatedCommission = isPaid ? (deal.Commission_Amount_NZD__c ?? 0) : commission
    return {
      ...deal,
      amountNZD,
      cumulativeAmountNZD: cumulative,
      attainmentBefore,
      attainmentAfter,
      calculatedCommission,
      effectiveRate: amountNZD !== 0 ? calculatedCommission / amountNZD : 0,
      band: bandForAttainment(attainmentAfter, bands),
    }
  })
}

const NO_PLAN_BAND: CommissionBand = { key: '0', name: '0', emoji: '', max: null, rate: 0 }

/** No comp plan set for this quarter — deals still list, but nothing is calculated. */
function zeroFillDeals(deals: SFCommissionOpportunity[]): CommissionDeal[] {
  let cumulative = 0
  return deals.map(deal => {
    const amountNZD = toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c)
    cumulative += amountNZD
    return {
      ...deal,
      amountNZD,
      cumulativeAmountNZD: cumulative,
      attainmentBefore: 0,
      attainmentAfter: 0,
      calculatedCommission: 0,
      effectiveRate: 0,
      band: NO_PLAN_BAND,
    }
  })
}

/** `deals` should all belong to a single owner — this only splits them by quarter. */
export function buildQuarterGroups(
  deals: SFCommissionOpportunity[],
  settingsByQuarter: Record<string, { quota: number; bands: CommissionBand[] }> = {}
): QuarterCommissionGroup[] {
  const byQuarter = new Map<string, SFCommissionOpportunity[]>()
  for (const deal of deals) {
    const key = quarterKeyForDate(deal.CloseDate)
    const list = byQuarter.get(key) ?? []
    list.push(deal)
    byQuarter.set(key, list)
  }

  const groups: QuarterCommissionGroup[] = []
  for (const [quarterKey, quarterDeals] of byQuarter) {
    const setting = settingsByQuarter[quarterKey]
    const hasPlan = setting != null
    const sorted = [...quarterDeals].sort(compareDealsForCommission)
    const commissionDeals = hasPlan ? applyCommissions(sorted, setting.quota, setting.bands) : zeroFillDeals(sorted)
    const totalAmount = commissionDeals.reduce((s, d) => s + d.amountNZD, 0)
    const totalCommission = commissionDeals.reduce((s, d) => s + d.calculatedCommission, 0)
    const totalSfCommissionAmount = commissionDeals.reduce((s, d) => s + (d.Commission_Amount_NZD__c ?? 0), 0)
    const totalSfPaidAmount = commissionDeals.reduce((s, d) => s + (d.Commission_Paid_Amount_NZD__c ?? 0), 0)
    groups.push({
      quarterKey,
      quarterLabel: quarterLabel(quarterKey),
      hasPlan,
      quota: hasPlan ? setting.quota : 0,
      bands: hasPlan ? setting.bands : [],
      deals: commissionDeals,
      totalAmount,
      totalCommission,
      totalSfCommissionAmount,
      totalSfPaidAmount,
      finalAttainment: hasPlan && setting.quota > 0 ? totalAmount / setting.quota : 0,
    })
  }

  return groups.sort((a, b) => b.quarterKey.localeCompare(a.quarterKey))
}
