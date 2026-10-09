import type { CommissionBand, CommissionDeal, CompPlan, QuarterCommissionGroup, SFCommissionOpportunity } from './types'
import { toNZD } from './currency'
import { quarterKeyForDate, quarterLabel } from './quarters'

export const DEFAULT_QUOTA = 50000

/** Pre-filled flat expansion rate for newly added plans only — existing plans without one keep expansions in the bands. */
export const DEFAULT_EXPANSION_RATE = 0.08

export const DEFAULT_BANDS: CommissionBand[] = [
  { key: '1', name: '1', emoji: '', max: 0.50,     rate: 0.2245 },
  { key: '2', name: '2', emoji: '', max: 0.75,     rate: 0.3368 },
  { key: '3', name: '3', emoji: '', max: 1.00,     rate: 0.449 },
  { key: '4', name: '4', emoji: '', max: null, rate: 0.6735 },
]

/** New Business opportunity record type — the only deals that count toward quota when a quarter has a flat expansion rate. */
export const NEW_BUSINESS_RECORD_TYPE_ID = '0127F000001JcfTQAS'

/** Matches on the 15-char prefix so both 15- and 18-char Salesforce Ids compare equal. */
export function isNewBusiness(deal: SFCommissionOpportunity): boolean {
  return (deal.RecordTypeId ?? '').slice(0, 15) === NEW_BUSINESS_RECORD_TYPE_ID.slice(0, 15)
}

function tierOf(deal: SFCommissionOpportunity): number {
  if (deal.Commission_Paid__c) return 0
  if (deal.Commission_Payout_Threshold_Met__c) return 1
  return 2
}

/** The real, already-locked effective rate for a paid deal — independent of processing order. */
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
 * Within the paid tier, order by commission rate ascending — since that rate
 * is locked and order-independent, this shows the steady rate progression
 * (and the calculation order) rather than an arbitrary close-date ordering.
 * The threshold-met and "everything else" tiers order by Close Date.
 */
function compareDealsForCommission(a: SFCommissionOpportunity, b: SFCommissionOpportunity): number {
  const ta = tierOf(a)
  const tb = tierOf(b)
  if (ta !== tb) return ta - tb
  if (ta === 0) {
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
      isExpansionFlat: false,
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
      isExpansionFlat: false,
    }
  })
}

function flatRateBand(rate: number): CommissionBand {
  return { key: 'exp', name: 'Expansion', emoji: '', max: null, rate }
}

/**
 * Non-New-Business deals in a quarter with a flat expansion rate: each earns `amount × rate`
 * (paid deals keep their locked SF amount, same as `applyCommissions`) and none of them move
 * quota attainment. Attainment fields are left at 0 — they don't apply to these deals.
 */
function applyFlatRate(deals: SFCommissionOpportunity[], rate: number): CommissionDeal[] {
  let cumulative = 0
  const band = flatRateBand(rate)
  return deals.map(deal => {
    const amountNZD = toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c)
    cumulative += amountNZD
    const isPaid = deal.Commission_Paid__c === true
    const calculatedCommission = isPaid ? (deal.Commission_Amount_NZD__c ?? 0) : amountNZD * rate
    return {
      ...deal,
      amountNZD,
      cumulativeAmountNZD: cumulative,
      attainmentBefore: 0,
      attainmentAfter: 0,
      calculatedCommission,
      effectiveRate: amountNZD !== 0 ? calculatedCommission / amountNZD : 0,
      band,
      isExpansionFlat: true,
    }
  })
}

function calculateQuarterDeals(sorted: SFCommissionOpportunity[], plan: CompPlan | undefined): CommissionDeal[] {
  if (!plan) return zeroFillDeals(sorted)
  if (plan.expansionRate == null) return applyCommissions(sorted, plan.quota, plan.bands)
  const newBusiness = applyCommissions(sorted.filter(isNewBusiness), plan.quota, plan.bands)
  const expansion = applyFlatRate(sorted.filter(d => !isNewBusiness(d)), plan.expansionRate)
  // Flat-rate deals listed after the band walk, so band breaks stay contiguous in the table.
  return [...newBusiness, ...expansion]
}

const sumAmount = (deals: CommissionDeal[]) => deals.reduce((s, d) => s + d.amountNZD, 0)
const sumCommission = (deals: CommissionDeal[]) => deals.reduce((s, d) => s + d.calculatedCommission, 0)

/** `deals` should all belong to a single owner — this only splits them by quarter. */
export function buildQuarterGroups(
  deals: SFCommissionOpportunity[],
  settingsByQuarter: Record<string, CompPlan> = {}
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
    const expansionRate = hasPlan ? (setting.expansionRate ?? null) : null
    const sorted = [...quarterDeals].sort(compareDealsForCommission)
    const commissionDeals = calculateQuarterDeals(sorted, setting)
    const newBusinessDeals = commissionDeals.filter(isNewBusiness)
    const expansionDeals = commissionDeals.filter(d => !isNewBusiness(d))
    const totalAmount = sumAmount(commissionDeals)
    const newBusinessAmount = sumAmount(newBusinessDeals)
    const totalSfCommissionAmount = commissionDeals.reduce((s, d) => s + (d.Commission_Amount_NZD__c ?? 0), 0)
    const totalSfPaidAmount = commissionDeals.reduce((s, d) => s + (d.Commission_Paid_Amount_NZD__c ?? 0), 0)
    const quotaCountedAmount = expansionRate != null ? newBusinessAmount : totalAmount
    groups.push({
      quarterKey,
      quarterLabel: quarterLabel(quarterKey),
      hasPlan,
      quota: hasPlan ? setting.quota : 0,
      bands: hasPlan ? setting.bands : [],
      deals: commissionDeals,
      totalAmount,
      totalCommission: sumCommission(commissionDeals),
      totalSfCommissionAmount,
      totalSfPaidAmount,
      finalAttainment: hasPlan && setting.quota > 0 ? quotaCountedAmount / setting.quota : 0,
      expansionRate,
      newBusinessAmount,
      newBusinessCommission: sumCommission(newBusinessDeals),
      expansionAmount: sumAmount(expansionDeals),
      expansionCommission: sumCommission(expansionDeals),
    })
  }

  return groups.sort((a, b) => b.quarterKey.localeCompare(a.quarterKey))
}
