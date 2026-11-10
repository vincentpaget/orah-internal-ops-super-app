import type { SFCommissionOpportunity } from './types'
import { onboardingPendingNow } from './payments'

export interface PendingRepGroup {
  ownerId: string
  ownerName: string
  /** ARR commission still below its payout threshold. */
  deals: SFCommissionOpportunity[]
  /** Onboarding commission whose fee the customer hasn't paid yet. */
  onboardingDeals: SFCommissionOpportunity[]
  dealCount: number
}

/** ARR still pending: the deal hasn't met its payout threshold and its commission isn't fully paid. */
export function isArrPending(deal: SFCommissionOpportunity): boolean {
  return !deal.Commission_Payout_Threshold_Met__c && !deal.Commission_Paid__c
    && (deal.Commission_Payout_Threshold__c != null || deal.Commission_Amount_NZD__c != null)
}

/**
 * Groups by rep only, as two separate lists like the Rep Summary — ARR pending (sorted by next invoice date) and
 * onboarding pending. A deal can be in both.
 */
export function buildPendingGroups(deals: SFCommissionOpportunity[]): PendingRepGroup[] {
  const byOwner = new Map<string, SFCommissionOpportunity[]>()
  for (const deal of deals.filter(d => isArrPending(d) || onboardingPendingNow(d) !== 0)) {
    const list = byOwner.get(deal.OwnerId) ?? []
    list.push(deal)
    byOwner.set(deal.OwnerId, list)
  }

  const groups: PendingRepGroup[] = []
  for (const [ownerId, ownerDeals] of byOwner) {
    const sorted = ownerDeals.filter(isArrPending).sort((a, b) => {
      const aDate = a.Maxio_Next_Invoice_Date__c
      const bDate = b.Maxio_Next_Invoice_Date__c
      if (aDate == null && bDate == null) return 0
      if (aDate == null) return 1
      if (bDate == null) return -1
      return aDate.localeCompare(bDate)
    })
    groups.push({
      ownerId,
      ownerName: ownerDeals[0]['Owner.Name'],
      deals: sorted,
      onboardingDeals: ownerDeals.filter(d => onboardingPendingNow(d) !== 0).sort((a, b) => a.CloseDate.localeCompare(b.CloseDate)),
      dealCount: ownerDeals.length,
    })
  }

  return groups.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}
