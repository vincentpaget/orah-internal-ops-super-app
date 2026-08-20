export interface SFCommissionOpportunity {
  Id: string
  Name: string
  OwnerId: string
  'Owner.Name': string
  /** The actual Salesforce record Owner's name — kept separate from `'Owner.Name'` above,
   *  which is the ARR Bookings split owner (the commission owner) and can differ from this. */
  recordOwnerName: string
  RecordTypeId: string | null
  'RecordType.Name': string | null
  StageName: string
  CloseDate: string
  CurrencyIsoCode: string | null
  Static_Currency_Conversion_Rate__c: number | null
  Net_ARR_Override__c: number | null
  Contract_Term_Length_Months__c: number | null
  Contract_Start_Date__c: string | null
  Total_Invoice_Amount_Paid__c: number | null
  Maxio_Next_Invoice_Date__c: string | null
  Commission_Payout_Threshold__c: number | null
  Commission_Payout_Threshold_Met__c: boolean
  Commission_Amount_NZD__c: number | null
  Commission_Paid__c: boolean
  Commission_Paid_Amount_NZD__c: number | null
  Commission_Paid_Date__c: string | null
  Commission_Notes__c: string | null
}

export interface CommissionBand {
  key: string
  name: string
  emoji: string
  /** Upper bound as a fraction of quota (e.g. 0.5 = 50%), or `null` for an uncapped top band.
   *  Deliberately `null`, not `Infinity` — `Infinity` isn't valid JSON and silently becomes
   *  `null` on any JSON round-trip (client fetch bodies, the Redis client's serializer), so
   *  `null` is the one representation of "uncapped" that survives storage intact. */
  max: number | null
  rate: number
}

export interface CommissionDeal extends SFCommissionOpportunity {
  amountNZD: number
  cumulativeAmountNZD: number
  attainmentBefore: number
  attainmentAfter: number
  calculatedCommission: number
  effectiveRate: number
  band: CommissionBand
}

export interface DealEdit {
  commissionAmount?: number | null
  commissionNotes?: string | null
  commissionPaid?: boolean | null
  commissionPaidAmount?: number | null
  commissionPaidDate?: string | null
}

export type DealEditFieldValue = number | string | boolean | null

export type SyncDealFn = (
  dealId: string,
  commissionAmountNZD: number | null,
  commissionNotes: string | null,
  commissionPaid: boolean | null,
  commissionPaidAmountNZD: number | null,
  commissionPaidDate: string | null
) => void

export type SyncStatus = 'syncing' | 'success' | 'error'

export interface QuarterCommissionGroup {
  quarterKey: string
  quarterLabel: string
  hasPlan: boolean
  quota: number
  bands: CommissionBand[]
  deals: CommissionDeal[]
  totalAmount: number
  totalCommission: number
  totalSfCommissionAmount: number
  totalSfPaidAmount: number
  finalAttainment: number
}

/** A rep+quarter comp plan, keyed by `${repName}::${quarterKey}` — or `'empty'` if the rep had no plan that period. */
export type StoredCompPlan = { quota: number; bands: CommissionBand[] } | 'empty'
export type CompPlanSettings = Record<string, StoredCompPlan>
