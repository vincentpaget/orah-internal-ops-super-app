import type { SFCommissionOpportunity } from './types'
import { toNZD } from './currency'

export interface PayableMonthGroup {
  monthKey: string
  monthLabel: string
  deals: SFCommissionOpportunity[]
  dealCount: number
  totalAmountNZD: number
  totalCommissionAmountNZD: number
}

export interface PayableRepGroup {
  ownerId: string
  ownerName: string
  months: PayableMonthGroup[]
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

export function buildPayableGroups(deals: SFCommissionOpportunity[]): PayableRepGroup[] {
  const byOwner = new Map<string, SFCommissionOpportunity[]>()
  for (const deal of deals) {
    const list = byOwner.get(deal.OwnerId) ?? []
    list.push(deal)
    byOwner.set(deal.OwnerId, list)
  }

  const repGroups: PayableRepGroup[] = []
  for (const [ownerId, ownerDeals] of byOwner) {
    const byMonth = new Map<string, SFCommissionOpportunity[]>()
    for (const deal of ownerDeals) {
      const key = monthKeyForDate(deal.Commission_Paid_Date__c)
      const list = byMonth.get(key) ?? []
      list.push(deal)
      byMonth.set(key, list)
    }

    const months: PayableMonthGroup[] = [...byMonth.entries()].map(([monthKey, monthDeals]) => {
      const sorted = [...monthDeals].sort((a, b) => a.CloseDate.localeCompare(b.CloseDate))
      return {
        monthKey,
        monthLabel: monthLabel(monthKey),
        deals: sorted,
        dealCount: sorted.length,
        totalAmountNZD: sorted.reduce((s, d) => s + toNZD(d.Net_ARR_Override__c, d.Static_Currency_Conversion_Rate__c), 0),
        totalCommissionAmountNZD: sorted.reduce((s, d) => s + (d.Commission_Amount_NZD__c ?? 0), 0),
      }
    })
    months.sort((a, b) => {
      if (a.monthKey === UNSCHEDULED_KEY) return 1
      if (b.monthKey === UNSCHEDULED_KEY) return -1
      return a.monthKey.localeCompare(b.monthKey)
    })

    repGroups.push({
      ownerId,
      ownerName: ownerDeals[0]['Owner.Name'],
      months,
      dealCount: ownerDeals.length,
      totalCommissionAmountNZD: months.reduce((s, m) => s + m.totalCommissionAmountNZD, 0),
    })
  }

  return repGroups.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}
