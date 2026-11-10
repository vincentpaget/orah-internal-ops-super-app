'use client'

import { useEffect, useState } from 'react'
import type { DealEdit, DealEditFieldValue, SFCommissionOpportunity, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { toNZD } from '@/lib/commissions/currency'
import { effectiveOnboardingPaidAmount, effectiveOnboardingPaidDate, onboardingCommissionAmount, onboardingInvoicedPaid, onboardingPayableNow, onboardingPendingNow, paidSource, recordOnboardingPaymentEdits } from '@/lib/commissions/payments'
import { ONBOARDING_SF_FIELD_NAMES } from '@/lib/commissions/onboarding'
import { nzd, percent, shortDate } from '@/lib/formatters'
import SalesforceLink from '@/components/ui/SalesforceLink'
import { EditToggleButton, localAmount, RecordPaymentButton, SyncCell, UndoButton } from './CommissionsTable'

interface Props {
  /** Deals with an onboarding / PS fee. `calculatedOnboardingCommission` must already be set (calc / applyOnboardingRates). */
  deals: SFCommissionOpportunity[]
  /** The plan's onboarding rate, shown in the heading (Rep Summary). Omit in summaries that span several plans. */
  rate?: number
  /** Heading override, e.g. "Onboarding Commission Payable". */
  title?: string
  /** Shown when there are no deals; when omitted, an empty table renders nothing at all. */
  emptyText?: string
  /** Show the record Owner column (the summaries list deals across reps' accounts, like their ARR tables). */
  showOwner?: boolean
  marginTop?: number
  /** False until an admin adds the onboarding commission fields to Opportunity — edits can be made, but Sync fails until then. */
  fieldsAvailable: boolean
  edits: Record<string, DealEdit>
  syncedEdits: Record<string, DealEdit>
  onEditField: (dealId: string, field: keyof DealEdit, value: DealEditFieldValue) => void
  onUndoEdits: (dealId: string) => void
  syncStatus: Record<string, SyncStatus>
  onSync: SyncDealFn
  canEdit: boolean
}

const TH: React.CSSProperties = {
  padding: '6px 10px', color: 'var(--fg-3)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
  letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', whiteSpace: 'normal', verticalAlign: 'bottom',
  background: 'var(--bg)', textAlign: 'left',
}
const TD: React.CSSProperties = {
  padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle', fontSize: 12, whiteSpace: 'nowrap',
}
const NUM: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const STICKY_1: React.CSSProperties = {
  position: 'sticky', left: 0, width: 260, minWidth: 260, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
  zIndex: 2, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)',
}
const EDIT_INPUT: React.CSSProperties = {
  height: 24, padding: '0 6px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)',
  color: 'var(--fg-1)', fontSize: 12, fontFamily: 'inherit', width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
}
const FOOT: React.CSSProperties = { ...TD, borderBottom: 'none', borderTop: '2px solid var(--border-strong)', background: 'var(--bg)' }
const ONBOARDING_FIELDS: (keyof DealEdit)[] = ['onboardingCommissionPaidAmount', 'onboardingCommissionPaidDate']

/** Actual onboarding paid ÷ fee (progress only — commission is still released all-or-nothing at 100%). */
function feePaidPct(deal: SFCommissionOpportunity): number | null {
  return deal.onboardingFeeAmount > 0 ? Math.min(1, onboardingInvoicedPaid(deal) / deal.onboardingFeeAmount) : null
}

const feeNZD = (deal: SFCommissionOpportunity) => toNZD(deal.onboardingFeeAmount, deal.Static_Currency_Conversion_Rate__c)

function dirty(dealId: string, field: keyof DealEdit, edits: Record<string, DealEdit>, synced: Record<string, DealEdit>): React.CSSProperties {
  const v = edits[dealId]?.[field]
  if (v === undefined || v === synced[dealId]?.[field]) return {}
  return { background: 'var(--orange-50)', boxShadow: 'inset 0 0 0 1px var(--orange-400)' }
}

/**
 * Onboarding & professional service fee commission (comp plan §5.2): a flat rate on the fee, outside the quota
 * bands. The commission is calculated here (fee × the plan's onboarding rate) and isn't stored in Salesforce — SF only
 * records the payout (Paid Amount, Paid Date), separately from the deal's ARR commission. All-or-nothing: a recorded
 * paid amount means it's been paid.
 *   Pending = awaiting the customer's payment of the fee.  Payable = fee paid in full, commission not yet paid.
 */
export default function OnboardingFeesTable({ deals, rate, title, emptyText, showOwner = false, marginTop = 36, fieldsAvailable, edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit }: Props) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const editable = canEdit

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

  /** Stages the onboarding payout (amount, today's date, paid tick) and opens the row for review — saved on Sync. */
  function recordPayment(deal: SFCommissionOpportunity) {
    for (const [field, value] of Object.entries(recordOnboardingPaymentEdits(deal, edits))) {
      onEditField(deal.Id, field as keyof DealEdit, value as DealEditFieldValue)
    }
    setEditingIds(prev => new Set(prev).add(deal.Id))
  }

  function toggleEditing(id: string) {
    setEditingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (deals.length === 0 && emptyText == null) return null

  const ratePct = rate != null ? `Flat ${Math.round(rate * 10000) / 100}% of the fee` : 'Flat rate on the fee'
  const totals = deals.reduce(
    (t, d) => ({
      fee: t.fee + feeNZD(d),
      commission: t.commission + onboardingCommissionAmount(d),
      pending: t.pending + onboardingPendingNow(d, edits),
      payable: t.payable + onboardingPayableNow(d, edits),
      paid: t.paid + (effectiveOnboardingPaidAmount(d, edits) ?? 0),
    }),
    { fee: 0, commission: 0, pending: 0, payable: 0, paid: 0 }
  )

  return (
    <div style={{ marginTop }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{title ?? 'Onboarding & Professional Service Fees'}</h3>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
          {ratePct}, payable once the fee is paid in full · not counted toward quota · SMS credits and hardware excluded
        </span>
      </div>

      {!fieldsAvailable && (
        <p style={{ fontSize: 12, color: 'var(--orange-700)', margin: '0 0 8px' }}>
          Salesforce doesn&apos;t have the onboarding commission fields yet ({ONBOARDING_SF_FIELD_NAMES.join(', ')}) — you can edit the paid fields here, but Sync will fail until a Salesforce admin adds them.
        </p>
      )}

      {deals.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic', margin: 0 }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: 'auto', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...TH, ...STICKY_1 }}>Opportunity</th>
                {showOwner && <th style={TH}>Owner</th>}
                <th style={TH}>Record Type</th>
                <th style={TH}>Close Date</th>
                <th style={{ ...TH, textAlign: 'right' }}>Fee (Local)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Fee (NZD)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Actual Onboarding Paid</th>
                <th style={{ ...TH, textAlign: 'right' }}>% of Fee Paid</th>
                <th style={{ ...TH, textAlign: 'right' }}>Commission Amount (NZD)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Pending Amount</th>
                <th style={{ ...TH, textAlign: 'right' }}>Payable Amount</th>
                <th style={{ ...TH, textAlign: 'right' }}>Commission Paid</th>
                <th style={TH}>Commission Paid Date</th>
                {editable && (
                  <>
                    <th style={{ ...TH, textAlign: 'center' }}>Edit</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Pay</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Undo</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Sync</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, i) => {
                const bg = i % 2 === 0 ? 'var(--bg-subtle)' : 'var(--bg)'
                const isEditing = editingIds.has(deal.Id)
                const paidAmount = effectiveOnboardingPaidAmount(deal, edits)
                const paidDate = effectiveOnboardingPaidDate(deal, edits)
                const pending = onboardingPendingNow(deal, edits)
                const payable = onboardingPayableNow(deal, edits)
                const pct = feePaidPct(deal)
                const hasOnboardingEdit = ONBOARDING_FIELDS.some(f => edits[deal.Id]?.[f] !== undefined)
                return (
                  <tr key={deal.Id} style={{ background: bg }}>
                    <td style={{ ...TD, ...STICKY_1, background: bg }}><SalesforceLink label={deal.Name} opportunityId={deal.Id} /></td>
                    {showOwner && <td style={{ ...TD, color: 'var(--fg-2)' }}>{deal.recordOwnerName || '—'}</td>}
                    <td style={{ ...TD, color: 'var(--fg-2)' }}>{deal['RecordType.Name'] ?? '—'}</td>
                    <td style={{ ...TD, color: 'var(--fg-2)' }}>{shortDate(deal.CloseDate)}</td>
                    <td style={{ ...TD, ...NUM, color: 'var(--fg-2)' }}>{localAmount(deal.onboardingFeeAmount, deal.CurrencyIsoCode)}</td>
                    <td style={{ ...TD, ...NUM, fontWeight: 600, color: 'var(--fg-1)' }}>{nzd(feeNZD(deal))}</td>
                    <td
                      style={{ ...TD, ...NUM }}
                      title={paidSource(deal) === 'maxio'
                        ? 'Onboarding / PS lines on Paid Maxio invoices'
                        : 'Estimate — no Maxio invoice lines linked to this opportunity: the whole fee once invoices paid cover it'}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        {paidSource(deal) === 'estimate' && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'var(--orange-50)', color: 'var(--orange-700)' }}>
                            Est.
                          </span>
                        )}
                        <span style={{ color: 'var(--fg-2)' }}>{localAmount(onboardingInvoicedPaid(deal), deal.CurrencyIsoCode)}</span>
                      </span>
                    </td>
                    <td style={{ ...TD, ...NUM, fontWeight: 600, color: pct == null ? 'var(--fg-3)' : pct >= 1 ? 'var(--green-700)' : pct > 0 ? 'var(--orange-700)' : 'var(--fg-2)' }}>
                      {percent(pct)}
                    </td>
                    <td style={{ ...TD, ...NUM, fontWeight: 700, color: 'var(--green-700)' }}>{nzd(onboardingCommissionAmount(deal))}</td>
                    <td style={{ ...TD, ...NUM, color: 'var(--fg-2)' }} title="Awaiting the customer's payment of the onboarding fee">
                      {pending !== 0 ? nzd(pending) : '—'}
                    </td>
                    <td style={{ ...TD, ...NUM, color: 'var(--fg-2)' }} title="Fee paid in full — commission not yet paid">
                      {payable !== 0 ? nzd(payable) : '—'}
                    </td>
                    <td style={{ ...TD, ...NUM, ...dirty(deal.Id, 'onboardingCommissionPaidAmount', edits, syncedEdits) }}>
                      {isEditing ? (
                        <input
                          type="number" step="1" value={paidAmount ?? ''}
                          onChange={e => onEditField(deal.Id, 'onboardingCommissionPaidAmount', e.target.value === '' ? null : Number(e.target.value))}
                          style={EDIT_INPUT}
                        />
                      ) : (
                        <span style={{ color: 'var(--fg-3)' }}>{nzd(paidAmount)}</span>
                      )}
                    </td>
                    <td style={{ ...TD, ...dirty(deal.Id, 'onboardingCommissionPaidDate', edits, syncedEdits) }}>
                      {isEditing ? (
                        <input
                          type="date" value={paidDate ?? ''}
                          onChange={e => onEditField(deal.Id, 'onboardingCommissionPaidDate', e.target.value || null)}
                          style={{ ...EDIT_INPUT, width: 130, textAlign: 'left' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--fg-2)' }}>{shortDate(paidDate)}</span>
                      )}
                    </td>
                    {editable && (
                      <>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <EditToggleButton editing={isEditing} onClick={() => toggleEditing(deal.Id)} />
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <RecordPaymentButton amount={payable} onClick={() => recordPayment(deal)} />
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <UndoButton disabled={!hasOnboardingEdit} onClick={() => onUndoEdits(deal.Id)} />
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <SyncCell
                            status={syncStatus[deal.Id]}
                            onClick={() => onSync(deal.Id, {
                              onboardingCommissionPaidAmount: paidAmount ?? null,
                              onboardingCommissionPaidDate: paidDate ?? null,
                            })}
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
                <td style={{ ...FOOT, ...STICKY_1, fontWeight: 700 }}>Onboarding total</td>
                <td style={FOOT} colSpan={showOwner ? 4 : 3} />
                <td style={{ ...FOOT, ...NUM, fontWeight: 700 }}>{nzd(totals.fee)}</td>
                <td style={FOOT} colSpan={2} />
                <td style={{ ...FOOT, ...NUM, fontWeight: 700, color: 'var(--green-700)' }}>{nzd(totals.commission)}</td>
                <td style={{ ...FOOT, ...NUM, fontWeight: 700 }}>{nzd(totals.pending)}</td>
                <td style={{ ...FOOT, ...NUM, fontWeight: 700 }}>{nzd(totals.payable)}</td>
                <td style={{ ...FOOT, ...NUM, fontWeight: 700 }}>{nzd(totals.paid)}</td>
                <td style={FOOT} colSpan={editable ? 5 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
