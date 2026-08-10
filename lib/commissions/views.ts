import type { CommissionDeal } from './types'

export const ALL_COLUMN_KEYS = [
  'closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD',
  'amountCumulative', 'attainment',
  'calculatedCommission', 'calculatedCommissionRate',
  'sfCommissionAmount', 'sfCommissionRate', 'payoutThreshold', 'totalInvoicePaid',
  'sfQualified', 'sfPaid', 'pendingAmount', 'payableAmount', 'sfPaidAmount', 'sfPaidDate', 'sfNotes',
]

export interface ColumnGroup {
  id: string
  label: string
  keys: string[]
}

export const COLUMN_GROUPS: ColumnGroup[] = [
  { id: 'basics', label: 'opportunity detail', keys: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal'] },
]

export interface DealView {
  key: string
  label: string
  filter: (deal: CommissionDeal) => boolean
  columns: string[]
}

export const DEAL_VIEWS: DealView[] = [
  {
    key: 'all',
    label: 'All Deals',
    filter: () => true,
    columns: ALL_COLUMN_KEYS,
  },
  {
    key: 'paid',
    label: 'Commission Paid',
    filter: d => d.Commission_Paid__c === true,
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfPaid', 'sfPaidAmount', 'sfPaidDate', 'sfNotes'],
  },
  {
    key: 'pending',
    label: 'Commission Payable',
    filter: d => d.Commission_Paid__c === false && d.Commission_Payout_Threshold_Met__c === true,
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfCommissionAmount', 'sfPaid', 'sfPaidAmount', 'sfPaidDate', 'sfNotes'],
  },
  {
    key: 'on_hold',
    label: 'Commission Pending',
    filter: d => d.Commission_Paid__c === false && d.Commission_Payout_Threshold_Met__c === false,
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfCommissionAmount', 'sfQualified', 'payoutThreshold', 'totalInvoicePaid', 'nextInvoiceDate', 'sfNotes'],
  },
]
