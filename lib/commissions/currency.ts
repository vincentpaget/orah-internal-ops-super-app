/**
 * Static_Currency_Conversion_Rate__c is the opportunity's currency expressed
 * per 1 NZD (e.g. 0.57424 for USD), so NZD = native amount / rate.
 */
export function toNZD(amount: number | null | undefined, rate: number | null | undefined): number {
  if (amount == null) return 0
  if (!rate || rate === 0) return amount
  return amount / rate
}
