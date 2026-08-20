'use client'

import { useEffect, useState } from 'react'
import type { CommissionDeal, DealEdit, DealEditFieldValue, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { COLUMN_GROUPS } from '@/lib/commissions/views'
import { nzd, percent, shortDate } from '@/lib/formatters'
import SalesforceLink from '@/components/ui/SalesforceLink'

interface Props {
  deals: CommissionDeal[]
  columns: string[]
  showBandLines?: boolean
  edits: Record<string, DealEdit>
  syncedEdits: Record<string, DealEdit>
  onEditField: (dealId: string, field: keyof DealEdit, value: DealEditFieldValue) => void
  onUndoEdits: (dealId: string) => void
  syncStatus: Record<string, SyncStatus>
  onSync: SyncDealFn
  canEdit: boolean
}

const STICKY_1_WIDTH = 260
const STRIPE_BG = 'var(--bg-subtle)'
const BAND_BREAK_BORDER = '2px solid'

const TH: React.CSSProperties = {
  padding: '6px 10px',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'normal',
  verticalAlign: 'bottom',
  background: 'var(--bg)',
}

const TD: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const STICKY_1: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  width: STICKY_1_WIDTH,
  minWidth: STICKY_1_WIDTH,
  maxWidth: STICKY_1_WIDTH,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  zIndex: 2,
  boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)',
}

const BAND_ACCENT_PALETTE = ['var(--fg-3)', 'var(--blue-500)', 'var(--green-600)', 'var(--purple-500)', 'var(--orange-700)', 'var(--red-600)']

function bandAccent(key: string): string {
  const n = Number(key)
  const idx = Number.isFinite(n) && n > 0 ? (n - 1) % BAND_ACCENT_PALETTE.length : 0
  return BAND_ACCENT_PALETTE[idx]
}

const EDIT_INPUT: React.CSSProperties = {
  height: 24,
  padding: '0 6px',
  borderRadius: 4,
  border: '1px solid var(--border-strong)',
  background: 'var(--bg)',
  color: 'var(--fg-1)',
  fontSize: 12,
  fontFamily: 'inherit',
}

function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange ? e => onChange(e.target.checked) : undefined}
      readOnly={!onChange}
      style={{ width: 15, height: 15, cursor: disabled || !onChange ? 'default' : 'pointer' }}
    />
  )
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, padding: '6px 10px', borderRadius: 6,
          background: 'var(--navy-900)', color: '#fff', fontSize: 11, fontWeight: 500,
          whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

function WarningIcon({ title = 'SF Commission Amount is empty' }: { title?: string }) {
  return (
    <Tooltip text={title}>
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14.5 13.5H1.5L8 2z" stroke="var(--orange-500)" strokeWidth="1.4" strokeLinejoin="round" fill="var(--orange-50)"/>
          <path d="M8 6.5v3M8 11.5v.1" stroke="var(--orange-700)" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </span>
    </Tooltip>
  )
}

function LockIcon() {
  return (
    <span title="Locked — matches the actual SF Commission Amount, since this deal has been paid" style={{ display: 'inline-flex', flexShrink: 0 }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="var(--fg-3)" strokeWidth="1.3"/>
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="var(--fg-3)" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </span>
  )
}

function EditToggleButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={editing ? 'Stop editing' : 'Edit'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: 'pointer',
        border: `1px solid ${editing ? 'var(--blue-500)' : 'var(--border)'}`,
        background: editing ? 'var(--blue-50)' : 'var(--bg)',
        color: editing ? 'var(--blue-500)' : 'var(--fg-2)',
      }}
    >
      {editing ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M11 2.3l2.7 2.7-8 8-3.2.8.8-3.2 8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}

function CopyToSfButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Copy Calculated Commission into SF Commission Amount"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: 'pointer',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--fg-2)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2.5 10V3.5a1 1 0 011-1H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

function UndoButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Undo edits — restore original Salesforce values"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: disabled ? 'var(--fg-3)' : 'var(--fg-2)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M4 4.5L1.8 6.7 4 8.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M1.8 6.7h7a4 4 0 110 8H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

function SyncCell({ status, onClick }: { status?: SyncStatus; onClick: () => void }) {
  if (status === 'syncing') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'sf-spin 0.8s linear infinite' }}>
        <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.7" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'success') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <button
      onClick={onClick}
      title={status === 'error' ? 'Sync failed — click to retry' : 'Sync to Salesforce'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: 'pointer',
        border: `1px solid ${status === 'error' ? 'var(--red-500)' : 'var(--border)'}`,
        background: 'var(--bg)',
        color: status === 'error' ? 'var(--red-600)' : 'var(--fg-2)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 2.5l2.3 1.8-1.8 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function GroupToggle({ label, collapsed, onClick }: { label: string; collapsed: boolean; onClick: () => void }) {
  const text = `${collapsed ? 'Show' : 'Hide'} ${label}`
  return (
    <button
      onClick={onClick}
      title={text}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 26, padding: '0 10px', borderRadius: 6,
        border: '1px solid var(--border)',
        background: collapsed ? 'var(--bg-subtle)' : 'var(--bg)',
        color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 150ms', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {text}
    </button>
  )
}

function localAmount(value: number | null, code: string | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: code ?? 'NZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function effectiveCommissionAmount(deal: CommissionDeal, edits: Record<string, DealEdit>): number | null {
  const edit = edits[deal.Id]
  return edit?.commissionAmount !== undefined ? edit.commissionAmount : deal.Commission_Amount_NZD__c
}

function effectivePaidOf(deal: CommissionDeal, edits: Record<string, DealEdit>): boolean {
  const edit = edits[deal.Id]
  return (edit?.commissionPaid !== undefined ? edit.commissionPaid : deal.Commission_Paid__c) ?? false
}

const CALCULATED_KEYS = new Set(['calculatedCommission', 'calculatedCommissionRate'])
const CALCULATED_BORDER = '1px solid var(--border-strong)'

function calculatedColumnStyle(key: string, visibleKeys: string[]): React.CSSProperties {
  if (key === 'sfCommissionRate') return { borderRight: CALCULATED_BORDER }
  if (!CALCULATED_KEYS.has(key)) return {}
  const idx = visibleKeys.indexOf(key)
  const isFirst = idx === 0 || !CALCULATED_KEYS.has(visibleKeys[idx - 1])
  const isLast = idx === visibleKeys.length - 1 || !CALCULATED_KEYS.has(visibleKeys[idx + 1])
  return {
    ...(isFirst ? { borderLeft: CALCULATED_BORDER } : {}),
    ...(isLast ? { borderRight: CALCULATED_BORDER } : {}),
  }
}

const DIRTY_FIELD_BY_KEY: Partial<Record<string, keyof DealEdit>> = {
  sfCommissionAmount: 'commissionAmount',
  sfNotes: 'commissionNotes',
  sfPaid: 'commissionPaid',
  sfPaidAmount: 'commissionPaidAmount',
  sfPaidDate: 'commissionPaidDate',
}

/** A cell is "dirty" once its field has been edited and that edit hasn't matched a successful sync yet. */
function dirtyCellStyle(
  key: string,
  dealId: string,
  edits: Record<string, DealEdit>,
  syncedEdits: Record<string, DealEdit>
): React.CSSProperties {
  const field = DIRTY_FIELD_BY_KEY[key]
  if (!field) return {}
  const editValue = edits[dealId]?.[field]
  if (editValue === undefined) return {}
  if (editValue === syncedEdits[dealId]?.[field]) return {}
  return {
    background: 'var(--orange-50)',
    boxShadow: 'inset 0 0 0 1px var(--orange-400)',
  }
}

interface ColumnDef {
  header: string
  align: 'left' | 'right'
  minWidth?: number
  cell: (deal: CommissionDeal) => React.ReactNode
}

export default function CommissionsTable({ deals, columns, showBandLines = true, edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit }: Props) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(COLUMN_GROUPS.map(g => g.id)))

  useEffect(() => {
    const doneIds = Object.entries(syncStatus).filter(([, s]) => s === 'success').map(([id]) => id)
    if (doneIds.length === 0) return
    setEditingIds(prev => {
      if (!doneIds.some(id => prev.has(id))) return prev
      const next = new Set(prev)
      doneIds.forEach(id => next.delete(id))
      return next
    })
  }, [syncStatus])

  if (deals.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>No deals.</p>
  }

  function toggleEditing(id: string) {
    setEditingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(id: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const COLUMN_DEFS: Record<string, ColumnDef> = {
    closeDate: {
      header: 'Close Date', align: 'left',
      cell: deal => <span style={{ color: 'var(--fg-2)' }}>{shortDate(deal.CloseDate)}</span>,
    },
    stage: {
      header: 'Stage', align: 'left',
      cell: deal => <span style={{ color: 'var(--fg-1)' }}>{deal.StageName}</span>,
    },
    recordType: {
      header: 'Record Type', align: 'left',
      cell: deal => <span style={{ color: 'var(--fg-2)' }}>{deal['RecordType.Name'] ?? '—'}</span>,
    },
    contractStart: {
      header: 'Contract Start', align: 'left',
      cell: deal => <span style={{ color: 'var(--fg-2)' }}>{shortDate(deal.Contract_Start_Date__c)}</span>,
    },
    amountLocal: {
      header: 'Amount (Local)', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{localAmount(deal.Net_ARR_Override__c, deal.CurrencyIsoCode)}</span>,
    },
    amountNZD: {
      header: 'Amount (NZD)', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--fg-1)' }}>{nzd(deal.amountNZD)}</span>,
    },
    amountCumulative: {
      header: 'Amount Cumulative', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{nzd(deal.cumulativeAmountNZD)}</span>,
    },
    attainment: {
      header: 'Attainment', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: bandAccent(deal.band.key) }}>{percent(deal.attainmentAfter)}</span>,
    },
    calculatedCommission: {
      header: 'Calculated Commission', align: 'right',
      cell: deal => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
          {deal.Commission_Paid__c && <LockIcon />}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{nzd(deal.calculatedCommission)}</span>
        </span>
      ),
    },
    calculatedCommissionRate: {
      header: 'Calculated Commission Rate', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{deal.amountNZD !== 0 ? percent(deal.effectiveRate, 2) : '—'}</span>,
    },
    sfCommissionAmount: {
      header: 'SF Commission Amount', align: 'right',
      cell: deal => {
        const effective = effectiveCommissionAmount(deal, edits)
        const isEditing = editingIds.has(deal.Id)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {effective == null && <WarningIcon />}
            {isEditing ? (
              <input
                type="number"
                step="1"
                autoFocus
                value={effective ?? ''}
                onChange={e => onEditField(deal.Id, 'commissionAmount', e.target.value === '' ? null : Number(e.target.value))}
                style={{ ...EDIT_INPUT, width: 90, textAlign: 'right', fontWeight: 700, color: 'var(--green-700)', fontVariantNumeric: 'tabular-nums' }}
              />
            ) : (
              <span style={{ fontWeight: 700, color: 'var(--green-700)', fontVariantNumeric: 'tabular-nums' }}>{nzd(effective)}</span>
            )}
          </span>
        )
      },
    },
    sfCommissionRate: {
      header: 'SF Commission Rate', align: 'right',
      cell: deal => {
        const effective = effectiveCommissionAmount(deal, edits)
        const rate = deal.amountNZD !== 0 && effective != null ? effective / deal.amountNZD : null
        const mismatch = rate != null && Math.abs(rate - deal.effectiveRate) > 0.001
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {mismatch && <WarningIcon title="SF Commission Rate does not match Calculated Commission Rate" />}
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{rate != null ? percent(rate, 2) : '—'}</span>
          </span>
        )
      },
    },
    sfQualified: {
      header: 'SF Payout Threshold Met', align: 'left',
      cell: deal => <Checkbox checked={deal.Commission_Payout_Threshold_Met__c} disabled />,
    },
    payoutThreshold: {
      header: 'Payout Threshold', align: 'right',
      cell: deal => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {deal.Commission_Payout_Threshold__c == null && <WarningIcon title="Payout Threshold is empty" />}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{localAmount(deal.Commission_Payout_Threshold__c, deal.CurrencyIsoCode)}</span>
        </span>
      ),
    },
    totalInvoicePaid: {
      header: 'Total Invoice Amount Paid', align: 'right',
      cell: deal => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{localAmount(deal.Total_Invoice_Amount_Paid__c, deal.CurrencyIsoCode)}</span>,
    },
    nextInvoiceDate: {
      header: 'Next Invoice Date', align: 'left',
      cell: deal => <span style={{ color: 'var(--fg-2)' }}>{shortDate(deal.Maxio_Next_Invoice_Date__c)}</span>,
    },
    sfPaid: {
      header: 'SF Commission Paid', align: 'left',
      cell: deal => {
        const effective = effectivePaidOf(deal, edits)
        const isEditing = editingIds.has(deal.Id)
        return (
          <Checkbox
            checked={effective}
            disabled={!isEditing}
            onChange={isEditing ? checked => onEditField(deal.Id, 'commissionPaid', checked) : undefined}
          />
        )
      },
    },
    pendingAmount: {
      header: 'Pending Amount', align: 'right',
      cell: deal => {
        const show = !effectivePaidOf(deal, edits) && deal.Commission_Payout_Threshold_Met__c === false
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{show ? nzd(effectiveCommissionAmount(deal, edits)) : '—'}</span>
      },
    },
    payableAmount: {
      header: 'Payable Amount', align: 'right',
      cell: deal => {
        const show = !effectivePaidOf(deal, edits) && deal.Commission_Payout_Threshold_Met__c === true
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{show ? nzd(effectiveCommissionAmount(deal, edits)) : '—'}</span>
      },
    },
    sfPaidAmount: {
      header: 'SF Commission Paid Amount', align: 'right',
      cell: deal => {
        const edit = edits[deal.Id]
        const effective = edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : deal.Commission_Paid_Amount_NZD__c
        const isEditing = editingIds.has(deal.Id)
        return isEditing ? (
          <input
            type="number"
            step="1"
            value={effective ?? ''}
            onChange={e => onEditField(deal.Id, 'commissionPaidAmount', e.target.value === '' ? null : Number(e.target.value))}
            style={{ ...EDIT_INPUT, width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          />
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-3)' }}>{nzd(effective)}</span>
        )
      },
    },
    sfPaidDate: {
      header: 'SF Commission Paid Date', align: 'left',
      cell: deal => {
        const edit = edits[deal.Id]
        const effective = edit?.commissionPaidDate !== undefined ? edit.commissionPaidDate : deal.Commission_Paid_Date__c
        const isEditing = editingIds.has(deal.Id)
        return isEditing ? (
          <input
            type="date"
            value={effective ?? ''}
            onChange={e => onEditField(deal.Id, 'commissionPaidDate', e.target.value || null)}
            style={{ ...EDIT_INPUT, width: 130 }}
          />
        ) : (
          <span style={{ color: 'var(--fg-3)' }}>{shortDate(effective)}</span>
        )
      },
    },
    sfNotes: {
      header: 'SF Commission Notes', align: 'left',
      minWidth: 320,
      cell: deal => {
        const edit = edits[deal.Id]
        const effective = edit?.commissionNotes !== undefined ? edit.commissionNotes : deal.Commission_Notes__c
        const isEditing = editingIds.has(deal.Id)
        return isEditing ? (
          <input
            type="text"
            value={effective ?? ''}
            onChange={e => onEditField(deal.Id, 'commissionNotes', e.target.value)}
            style={{ ...EDIT_INPUT, width: '100%', minWidth: 300 }}
          />
        ) : (
          <span style={{ color: 'var(--fg-3)' }}>{effective || '—'}</span>
        )
      },
    },
  }

  const hiddenKeys = new Set<string>()
  COLUMN_GROUPS.forEach(group => {
    if (collapsedGroups.has(group.id)) group.keys.forEach(k => hiddenKeys.add(k))
  })

  const visibleKeys = columns.filter(key => COLUMN_DEFS[key] && !hiddenKeys.has(key))
  const relevantGroups = COLUMN_GROUPS.filter(group => group.keys.some(k => columns.includes(k)))

  const totalAmountNZD = deals.reduce((s, d) => s + d.amountNZD, 0)
  const totalSfCommissionAmount = deals.reduce((s, d) => s + (effectiveCommissionAmount(d, edits) ?? 0), 0)
  const totalSfPaidAmount = deals.reduce((s, d) => {
    const edit = edits[d.Id]
    const effective = edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : d.Commission_Paid_Amount_NZD__c
    return s + (effective ?? 0)
  }, 0)
  const totalPendingAmount = deals.reduce((s, d) => {
    const show = !effectivePaidOf(d, edits) && d.Commission_Payout_Threshold_Met__c === false
    return s + (show ? (effectiveCommissionAmount(d, edits) ?? 0) : 0)
  }, 0)
  const totalPayableAmount = deals.reduce((s, d) => {
    const show = !effectivePaidOf(d, edits) && d.Commission_Payout_Threshold_Met__c === true
    return s + (show ? (effectiveCommissionAmount(d, edits) ?? 0) : 0)
  }, 0)
  const totalCalculatedCommission = deals.reduce((s, d) => s + d.calculatedCommission, 0)
  const finalAttainmentShown = deals.length > 0 ? deals[deals.length - 1].attainmentAfter : 0

  const FOOTER_VALUES: Record<string, React.ReactNode> = {
    amountNZD: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{nzd(totalAmountNZD)}</span>,
    attainment: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{percent(finalAttainmentShown)}</span>,
    calculatedCommission: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{nzd(totalCalculatedCommission)}</span>,
    sfCommissionAmount: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--green-700)' }}>{nzd(totalSfCommissionAmount)}</span>,
    pendingAmount: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{nzd(totalPendingAmount)}</span>,
    payableAmount: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{nzd(totalPayableAmount)}</span>,
    sfPaidAmount: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)' }}>{nzd(totalSfPaidAmount)}</span>,
  }

  return (
    <div>
      {relevantGroups.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {relevantGroups.map(group => (
            <GroupToggle
              key={group.id}
              label={group.label}
              collapsed={collapsedGroups.has(group.id)}
              onClick={() => toggleGroup(group.id)}
            />
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: 'auto', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...TH, ...STICKY_1, textAlign: 'left' }}>Opportunity</th>
              <th style={{ ...TH, textAlign: 'left' }}>Owner</th>
              {visibleKeys.map(key => (
                <th key={key} style={{ ...TH, textAlign: COLUMN_DEFS[key].align, minWidth: COLUMN_DEFS[key].minWidth, ...calculatedColumnStyle(key, visibleKeys) }}>{COLUMN_DEFS[key].header}</th>
              ))}
              {canEdit && (
                <>
                  <th style={{ ...TH, textAlign: 'center' }}>Edit</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Copy</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Undo</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Sync</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, i) => {
              const stripeBg = i % 2 === 0 ? STRIPE_BG : 'var(--bg)'
              const isBandBreak = showBandLines && i > 0 && deal.band.key !== deals[i - 1].band.key
              const breakBorder = isBandBreak ? { borderTop: `${BAND_BREAK_BORDER} ${bandAccent(deal.band.key)}` } : {}
              const edit = edits[deal.Id]
              const effectiveAmount = effectiveCommissionAmount(deal, edits)
              const effectiveNotes = edit?.commissionNotes !== undefined ? edit.commissionNotes : deal.Commission_Notes__c
              const effectivePaid = effectivePaidOf(deal, edits)
              const effectivePaidAmount = edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : deal.Commission_Paid_Amount_NZD__c
              const effectivePaidDate = edit?.commissionPaidDate !== undefined ? edit.commissionPaidDate : deal.Commission_Paid_Date__c
              return (
                <tr key={deal.Id} style={{ background: stripeBg }}>
                  <td style={{ ...TD, ...STICKY_1, ...breakBorder, textAlign: 'left', background: stripeBg }}>
                    <SalesforceLink label={deal.Name} opportunityId={deal.Id} />
                  </td>
                  <td style={{ ...TD, ...breakBorder, textAlign: 'left', color: 'var(--fg-2)' }}>{deal.recordOwnerName || '—'}</td>
                  {visibleKeys.map(key => (
                    <td
                      key={key}
                      style={{
                        ...TD, ...breakBorder,
                        textAlign: COLUMN_DEFS[key].align,
                        minWidth: COLUMN_DEFS[key].minWidth,
                        ...calculatedColumnStyle(key, visibleKeys),
                        ...dirtyCellStyle(key, deal.Id, edits, syncedEdits),
                      }}
                    >
                      {COLUMN_DEFS[key].cell(deal)}
                    </td>
                  ))}
                  {canEdit && (
                    <>
                      <td style={{ ...TD, ...breakBorder, textAlign: 'center' }}>
                        <EditToggleButton editing={editingIds.has(deal.Id)} onClick={() => toggleEditing(deal.Id)} />
                      </td>
                      <td style={{ ...TD, ...breakBorder, textAlign: 'center' }}>
                        <CopyToSfButton onClick={() => onEditField(deal.Id, 'commissionAmount', deal.calculatedCommission)} />
                      </td>
                      <td style={{ ...TD, ...breakBorder, textAlign: 'center' }}>
                        <UndoButton disabled={!edit} onClick={() => onUndoEdits(deal.Id)} />
                      </td>
                      <td style={{ ...TD, ...breakBorder, textAlign: 'center' }}>
                        <SyncCell
                          status={syncStatus[deal.Id]}
                          onClick={() => onSync(
                            deal.Id,
                            effectiveAmount ?? null,
                            effectiveNotes ?? null,
                            effectivePaid ?? null,
                            effectivePaidAmount ?? null,
                            effectivePaidDate ?? null
                          )}
                        />
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...TD, ...STICKY_1, borderBottom: 'none', fontWeight: 700, color: 'var(--fg-1)', background: 'var(--bg)' }}>Total</td>
              <td style={{ ...TD, borderBottom: 'none' }} />
              {visibleKeys.map(key => (
                <td key={key} style={{ ...TD, borderBottom: 'none', textAlign: COLUMN_DEFS[key].align, ...calculatedColumnStyle(key, visibleKeys) }}>
                  {FOOTER_VALUES[key] ?? null}
                </td>
              ))}
              {canEdit && <td style={{ ...TD, borderBottom: 'none' }} colSpan={4} />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
