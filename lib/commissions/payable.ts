import type { SFCommissionOpportunity } from './types'
import { onboardingPayableNow, payableNow } from './payments'

export interface PayableMonthGroup {
  monthKey: string
  monthLabel: string
  /** Deals with ARR commission payable now, scheduled this month by SF Commission Paid Date. */
  arrDeals: SFCommissionOpportunity[]
  /** Deals with onboarding commission payable now, scheduled this month by Onboarding Commission Paid Date. */
  onboardingDeals: SFCommissionOpportunity[]
  arrPayableNZD: number
  onboardingPayableNZD: number
  /** ARR + onboarding payable this month. */
  totalCommissionAmountNZD: number
}

export interface PayableRepGroup {
  ownerId: string
  ownerName: string
  months: PayableMonthGroup[]
  /** Distinct deals across both tables. */
  dealCount: number
  totalCommissionAmountNZD: number
}

const UNSCHEDULED_KEY = 'unscheduled'

function monthKeyForDate(dateStr: string | null): string {
  if (!dateStr) return UNSCHEDULED_KEY
  const [year, month] = dateStr.split('-')
  return `${year}-${month}`
}

function monthLabel(key: string): string {
  if (key === UNSCHEDULED_KEY) return 'No Date Set'
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
}

const byCloseDate = (a: SFCommissionOpportunity, b: SFCommissionOpportunity) => a.CloseDate.localeCompare(b.CloseDate)

/**
 * Payable commission by rep and pay-run month, kept as two separate lists like the Rep Summary: ARR commission
 * payable now (by its SF Commission Paid Date) and onboarding commission payable now (by its own paid date). A deal
 * can appear in both — e.g. half its ARR commission and all of its onboarding commission payable.
 */
export function buildPayableGroups(deals: SFCommissionOpportunity[]): PayableRepGroup[] {
  type Bucket = { arr: SFCommissionOpportunity[]; onboarding: SFCommissionOpportunity[] }
  const byOwner = new Map<string, { ownerName: string; ids: Set<string>; months: Map<string, Bucket> }>()

  function bucket(deal: SFCommissionOpportunity, date: string | null): Bucket {
    const owner = byOwner.get(deal.OwnerId) ?? { ownerName: deal['Owner.Name'], ids: new Set<string>(), months: new Map<string, Bucket>() }
    byOwner.set(deal.OwnerId, owner)
    owner.ids.add(deal.Id)
    const key = monthKeyForDate(date)
    const b = owner.months.get(key) ?? { arr: [], onboarding: [] }
    owner.months.set(key, b)
    return b
  }

  for (const deal of deals) {
    if (payableNow(deal) !== 0) bucket(deal, deal.Commission_Paid_Date__c).arr.push(deal)
    if (onboardingPayableNow(deal) !== 0) bucket(deal, deal.Onboarding_Commission_Paid_Date__c).onboarding.push(deal)
  }

  const repGroups: PayableRepGroup[] = []
  for (const [ownerId, owner] of byOwner) {
    const months: PayableMonthGroup[] = [...owner.months.entries()].map(([monthKey, b]) => {
      const arrPayableNZD = b.arr.reduce((s, d) => s + payableNow(d), 0)
      const onboardingPayableNZD = b.onboarding.reduce((s, d) => s + onboardingPayableNow(d), 0)
      return {
        monthKey,
        monthLabel: monthLabel(monthKey),
        arrDeals: [...b.arr].sort(byCloseDate),
        onboardingDeals: [...b.onboarding].sort(byCloseDate),
        arrPayableNZD,
        onboardingPayableNZD,
        totalCommissionAmountNZD: arrPayableNZD + onboardingPayableNZD,
      }
    })
    months.sort((a, b) => {
      if (a.monthKey === UNSCHEDULED_KEY) return 1
      if (b.monthKey === UNSCHEDULED_KEY) return -1
      return a.monthKey.localeCompare(b.monthKey)
    })
    repGroups.push({
      ownerId,
      ownerName: owner.ownerName,
      months,
      dealCount: owner.ids.size,
      totalCommissionAmountNZD: months.reduce((s, m) => s + m.totalCommissionAmountNZD, 0),
    })
  }

  return repGroups.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}

/** One payout in a pay run: a deal's ARR commission or its onboarding commission, each with its own paid date. */
export type PayRunPayment = SFCommissionOpportunity & {
  paymentKind: 'arr' | 'onboarding'
  paymentAmountNZD: number
  paymentDate: string | null
}

export interface PayRunRep {
  ownerId: string
  ownerName: string
  deals: PayRunPayment[]
  dealCount: number
  totalPaidNZD: number
}

export interface PayRun {
  monthKey: string
  monthLabel: string
  reps: PayRunRep[]
  dealCount: number
  repCount: number
  totalPaidNZD: number
}

/**
 * ARR commission paid to date — the SF Paid Amount, falling back to the SF Commission Amount for a deal ticked
 * paid with the amount left blank.
 */
export function arrPaidAmountNZD(deal: SFCommissionOpportunity): number {
  return deal.Commission_Paid_Amount_NZD__c ?? (deal.Commission_Paid__c ? (deal.Commission_Amount_NZD__c ?? 0) : 0)
}

/** Splits each deal into its payouts: ARR (on Commission Paid Date) and onboarding (on its own paid date). */
export function payRunPayments(deals: SFCommissionOpportunity[]): PayRunPayment[] {
  const payments: PayRunPayment[] = []
  for (const deal of deals) {
    const arr = arrPaidAmountNZD(deal)
    if (arr !== 0 || deal.Commission_Paid__c) {
      payments.push({ ...deal, paymentKind: 'arr', paymentAmountNZD: arr, paymentDate: deal.Commission_Paid_Date__c })
    }
    const onboarding = deal.Onboarding_Commission_Paid_Amount_NZD__c ?? 0
    if (onboarding !== 0) {
      payments.push({ ...deal, paymentKind: 'onboarding', paymentAmountNZD: onboarding, paymentDate: deal.Onboarding_Commission_Paid_Date__c })
    }
  }
  return payments
}

/** Payouts grouped into monthly pay runs (by each payout's paid date), newest first, then by rep. */
export function buildPayRunHistory(deals: SFCommissionOpportunity[]): PayRun[] {
  const byMonth = new Map<string, PayRunPayment[]>()
  for (const payment of payRunPayments(deals)) {
    const key = monthKeyForDate(payment.paymentDate)
    const list = byMonth.get(key) ?? []
    list.push(payment)
    byMonth.set(key, list)
  }

  const runs: PayRun[] = [...byMonth.entries()].map(([monthKey, monthDeals]) => {
    const byOwner = new Map<string, PayRunPayment[]>()
    for (const deal of monthDeals) {
      const list = byOwner.get(deal.OwnerId) ?? []
      list.push(deal)
      byOwner.set(deal.OwnerId, list)
    }
    const reps: PayRunRep[] = [...byOwner.entries()].map(([ownerId, ownerDeals]) => {
      const sorted = [...ownerDeals].sort((a, b) => a.CloseDate.localeCompare(b.CloseDate))
      return {
        ownerId,
        ownerName: sorted[0]['Owner.Name'],
        deals: sorted,
        dealCount: sorted.length,
        totalPaidNZD: sorted.reduce((s, d) => s + d.paymentAmountNZD, 0),
      }
    })
    reps.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
    return {
      monthKey,
      monthLabel: monthLabel(monthKey),
      reps,
      dealCount: monthDeals.length,
      repCount: reps.length,
      totalPaidNZD: reps.reduce((s, r) => s + r.totalPaidNZD, 0),
    }
  })

  return runs.sort((a, b) => {
    if (a.monthKey === UNSCHEDULED_KEY) return 1
    if (b.monthKey === UNSCHEDULED_KEY) return -1
    return b.monthKey.localeCompare(a.monthKey)
  })
}
