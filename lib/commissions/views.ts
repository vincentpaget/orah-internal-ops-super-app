import type { CommissionDeal } from './types'
import { payableNow, pendingNow } from './payments'

export const ALL_COLUMN_KEYS = [
  'closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD',
  'amountCumulative', 'attainment',
  'calculatedCommission', 'calculatedCommissionRate',
  'sfCommissionAmount', 'sfCommissionRate', 'payoutThreshold', 'totalInvoicePaid', 'arrPaid', 'invoicePaidPct',
  'sfQualified', 'pendingAmount', 'payableAmount', 'sfPaidAmount', 'sfPaidDate', 'sfPaid', 'sfNotes',
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
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfPaidAmount', 'sfPaidDate', 'sfPaid', 'sfNotes'],
  },
  {
    key: 'pending',
    label: 'Commission Payable',
    filter: d => payableNow(d) !== 0,
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfCommissionAmount', 'payableAmount', 'sfPaidAmount', 'sfPaidDate', 'sfPaid', 'sfNotes'],
  },
  {
    key: 'on_hold',
    label: 'Commission Pending',
    filter: d => pendingNow(d) !== 0,
    columns: ['closeDate', 'stage', 'recordType', 'contractStart', 'amountLocal', 'amountNZD', 'sfCommissionAmount', 'payoutThreshold', 'totalInvoicePaid', 'arrPaid', 'invoicePaidPct', 'sfQualified', 'nextInvoiceDate', 'sfPaidAmount', 'pendingAmount', 'sfNotes'],
  },
]
