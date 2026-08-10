'use client'

import { useEffect, useState } from 'react'
import type { DealEdit, DealEditFieldValue, SFCommissionOpportunity, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { buildPayableGroups } from '@/lib/commissions/payable'
import { toNZD } from '@/lib/commissions/currency'
import { downloadPayableSummaryPdf } from '@/lib/commissions/pdf'
import { nzd, shortDate } from '@/lib/formatters'
import SalesforceLink from '@/components/ui/SalesforceLink'

interface Props {
  deals: SFCommissionOpportunity[]
  edits: Record<string, DealEdit>
  syncedEdits: Record<string, DealEdit>
  onEditField: (dealId: string, field: keyof DealEdit, value: DealEditFieldValue) => void
  onUndoEdits: (dealId: string) => void
  syncStatus: Record<string, SyncStatus>
  onSync: SyncDealFn
  canEdit: boolean
}

const TH: React.CSSProperties = {
  padding: '6px 10px',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
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

const NOTES_MIN_WIDTH = 320

const STICKY_1_WIDTH = 260

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

function DownloadPdfButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Download this month's summary as a PDF"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 26, padding: '0 10px', borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5v9M8 10.5L4.5 7M8 10.5L11.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.5 12.5v1.5a1 1 0 001 1h9a1 1 0 001-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Download PDF
    </button>
  )
}

/** A cell is "dirty" once its field has been edited and that edit hasn't matched a successful sync yet. */
function dirtyStyle(
  dealId: string,
  field: keyof DealEdit,
  edits: Record<string, DealEdit>,
  syncedEdits: Record<string, DealEdit>
): React.CSSProperties {
  const editValue = edits[dealId]?.[field]
  if (editValue === undefined) return {}
  if (editValue === syncedEdits[dealId]?.[field]) return {}
  return {
    background: 'var(--orange-50)',
    boxShadow: 'inset 0 0 0 1px var(--orange-400)',
  }
}

export default function PayableSummaryView({ deals, edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit }: Props) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())

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
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>
        No payable deals right now — nothing has met its payout threshold while still being unpaid.
      </p>
    )
  }

  function toggleEditing(id: string) {
    setEditingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const repGroups = buildPayableGroups(deals)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 20px' }}>
        Deals that have met their payout threshold but aren&apos;t marked paid yet, grouped by rep and by SF Commission Paid Date month — use this to review what&apos;s going into the next pay run.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {repGroups.map(rep => (
          <div key={rep.ownerId}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{rep.ownerName}</h2>
              <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
                {rep.dealCount} deal{rep.dealCount === 1 ? '' : 's'} · {nzd(rep.totalCommissionAmountNZD)} payable
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {rep.months.map(month => {
                const totalPaidAmount = month.deals.reduce((s, d) => {
                  const edit = edits[d.Id]
                  const effective = edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : d.Commission_Paid_Amount_NZD__c
                  return s + (effective ?? 0)
                }, 0)
                return (
                <div key={month.monthKey}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', margin: 0 }}>{month.monthLabel}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                        {month.dealCount} deal{month.dealCount === 1 ? '' : 's'} · {nzd(month.totalCommissionAmountNZD)}
                      </span>
                      <DownloadPdfButton onClick={() => downloadPayableSummaryPdf(rep.ownerName, month.monthLabel, month.deals, edits)} />
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: 'auto', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ ...TH, ...STICKY_1 }}>Opportunity</th>
                          <th style={TH}>Close Date</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Amount (NZD)</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Commission Amount</th>
                          <th style={TH}>SF Commission Paid</th>
                          <th style={{ ...TH, textAlign: 'right' }}>SF Commission Paid Amount</th>
                          <th style={TH}>SF Commission Paid Date</th>
                          <th style={{ ...TH, minWidth: NOTES_MIN_WIDTH }}>SF Commission Notes</th>
                          {canEdit && (
                            <>
                              <th style={{ ...TH, textAlign: 'center' }}>Edit</th>
                              <th style={{ ...TH, textAlign: 'center' }}>Undo</th>
                              <th style={{ ...TH, textAlign: 'center' }}>Sync</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {month.deals.map((deal, i) => {
                          const edit = edits[deal.Id]
                          const isEditing = editingIds.has(deal.Id)
                          const effectivePaid = (edit?.commissionPaid !== undefined ? edit.commissionPaid : deal.Commission_Paid__c) ?? false
                          const effectivePaidAmount = edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : deal.Commission_Paid_Amount_NZD__c
                          const effectivePaidDate = edit?.commissionPaidDate !== undefined ? edit.commissionPaidDate : deal.Commission_Paid_Date__c
                          const effectiveNotes = edit?.commissionNotes !== undefined ? edit.commissionNotes : deal.Commission_Notes__c
                          const rowBg = i % 2 === 0 ? 'var(--bg-subtle)' : 'var(--bg)'
                          return (
                            <tr key={deal.Id} style={{ background: rowBg }}>
                              <td style={{ ...TD, ...STICKY_1, background: rowBg }}><SalesforceLink label={deal.Name} opportunityId={deal.Id} /></td>
                              <td style={{ ...TD, color: 'var(--fg-2)' }}>{shortDate(deal.CloseDate)}</td>
                              <td style={{ ...TD, textAlign: 'right', color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>
                                {nzd(toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c))}
                              </td>
                              <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: 'var(--green-700)', fontVariantNumeric: 'tabular-nums' }}>
                                {nzd(deal.Commission_Amount_NZD__c)}
                              </td>
                              <td style={{ ...TD, ...dirtyStyle(deal.Id, 'commissionPaid', edits, syncedEdits) }}>
                                <Checkbox
                                  checked={effectivePaid}
                                  disabled={!isEditing}
                                  onChange={isEditing ? checked => onEditField(deal.Id, 'commissionPaid', checked) : undefined}
                                />
                              </td>
                              <td style={{ ...TD, textAlign: 'right', ...dirtyStyle(deal.Id, 'commissionPaidAmount', edits, syncedEdits) }}>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="1"
                                    value={effectivePaidAmount ?? ''}
                                    onChange={e => onEditField(deal.Id, 'commissionPaidAmount', e.target.value === '' ? null : Number(e.target.value))}
                                    style={{ ...EDIT_INPUT, width: '100%', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                  />
                                ) : (
                                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{nzd(effectivePaidAmount)}</span>
                                )}
                              </td>
                              <td style={{ ...TD, ...dirtyStyle(deal.Id, 'commissionPaidDate', edits, syncedEdits) }}>
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={effectivePaidDate ?? ''}
                                    onChange={e => onEditField(deal.Id, 'commissionPaidDate', e.target.value || null)}
                                    style={{ ...EDIT_INPUT, width: '100%' }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--fg-2)' }}>{shortDate(effectivePaidDate)}</span>
                                )}
                              </td>
                              <td style={{ ...TD, minWidth: NOTES_MIN_WIDTH, ...dirtyStyle(deal.Id, 'commissionNotes', edits, syncedEdits) }}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={effectiveNotes ?? ''}
                                    onChange={e => onEditField(deal.Id, 'commissionNotes', e.target.value)}
                                    style={{ ...EDIT_INPUT, width: '100%', minWidth: 300 }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--fg-3)' }}>{effectiveNotes || '—'}</span>
                                )}
                              </td>
                              {canEdit && (
                                <>
                                  <td style={{ ...TD, textAlign: 'center' }}>
                                    <EditToggleButton editing={isEditing} onClick={() => toggleEditing(deal.Id)} />
                                  </td>
                                  <td style={{ ...TD, textAlign: 'center' }}>
                                    <UndoButton disabled={!edit} onClick={() => onUndoEdits(deal.Id)} />
                                  </td>
                                  <td style={{ ...TD, textAlign: 'center' }}>
                                    <SyncCell
                                      status={syncStatus[deal.Id]}
                                      onClick={() => onSync(
                                        deal.Id,
                                        deal.Commission_Amount_NZD__c ?? null,
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
                          <td style={{ ...TD, borderBottom: 'none' }} />
                          <td style={{ ...TD, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: 'var(--green-700)', fontVariantNumeric: 'tabular-nums' }}>
                            {nzd(month.totalCommissionAmountNZD)}
                          </td>
                          <td style={{ ...TD, borderBottom: 'none' }} />
                          <td style={{ ...TD, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
                            {nzd(totalPaidAmount)}
                          </td>
                          <td style={{ ...TD, borderBottom: 'none' }} colSpan={canEdit ? 5 : 2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
