import type { SFCommissionOpportunity } from './types'

export interface PendingRepGroup {
  ownerId: string
  ownerName: string
  deals: SFCommissionOpportunity[]
  dealCount: number
}

/** Groups by rep only — sorted by next invoice date within each rep, no further date grouping. */
export function buildPendingGroups(deals: SFCommissionOpportunity[]): PendingRepGroup[] {
  const byOwner = new Map<string, SFCommissionOpportunity[]>()
  for (const deal of deals) {
    const list = byOwner.get(deal.OwnerId) ?? []
    list.push(deal)
    byOwner.set(deal.OwnerId, list)
  }

  const groups: PendingRepGroup[] = []
  for (const [ownerId, ownerDeals] of byOwner) {
    const sorted = [...ownerDeals].sort((a, b) => {
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
      dealCount: sorted.length,
    })
  }

  return groups.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}
