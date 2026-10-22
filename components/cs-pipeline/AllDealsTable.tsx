'use client'

import { useEffect, useState } from 'react'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'
import type { CsPicklists } from '@/lib/salesforce'
import { getRenewalFlags, getExpansionFlags } from '@/lib/csHygiene'
import FlagsCell from './FlagsCell'
import SalesforceLink from '@/components/ui/SalesforceLink'
import DatePill from '@/components/ui/DatePill'
import { fmtCurrency, shortDate } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import { SpinnerIcon, PencilIcon, EDIT_FIELD, EDIT_TEXTAREA } from '@/components/sql-handoff/InlineEditKit'
import Toast from '@/components/sql-handoff/Toast'
import { outcomePill } from '@/lib/sql-handoff/logic'

interface Props {
  renewals: SFRenewalOpp[]
  expansions: SFExpansionOpp[]
  /** Dropdown options per record type. Null leaves Stage, Type and Category read-only. */
  picklists?: Record<'renewal' | 'expansion', CsPicklists> | null
}

type SortCol = 'flags' | 'stage' | 'arr_basis' | 'auto_renewal' | 'net_arr' | 'close_date' | 'last_meeting' | 'next_meeting' | 'last_touched'

// Fields that can be edited from the row's Edit button and written back to Salesforce
const EDIT_FIELDS = [
  'StageName', 'Type', 'Category__c', 'CloseDate', 'NextStep',
  'Expansion_Notes__c', 'Renewal_Risk_Notes__c', 'Manager_Review_Notes__c', 'Initial_Meeting_Outcome__c',
] as const
type EditField = typeof EDIT_FIELDS[number]
type TextField = 'NextStep' | 'Expansion_Notes__c' | 'Renewal_Risk_Notes__c' | 'Manager_Review_Notes__c'
type Draft = Record<EditField, string>
type Overrides = Record<string, Partial<Record<EditField, string | null>>>

// Next Step and all three notes fields are 255 characters in Salesforce
const TEXT_MAX = 255
type SortDir = 'asc' | 'desc'

export const STAGE_ORDER = ['Not Contacted', 'Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost', 'Closed Lost - Churned', 'Closed - Recycle', 'Closed - Disqualified']

export const CLOSED_RENEWAL_STAGES = new Set(['Closed Won', 'Closed Lost - Churned'])
export const CLOSED_EXPANSION_STAGES = new Set(['Closed Won', 'Closed Lost'])

export const TH: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'var(--bg-subtle)',
}

export const TD: React.CSSProperties = {
  padding: '11px 14px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
  ...FS.body,
  background: 'var(--bg)',
}

export const STICKY_TH: React.CSSProperties = {
  ...TH,
  position: 'sticky',
  left: 0,
  zIndex: 2,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}

export const STICKY_TD: React.CSSProperties = {
  ...TD,
  position: 'sticky',
  left: 0,
  zIndex: 1,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}

export const AMT_TH: React.CSSProperties = { ...TH, textAlign: 'right' }
export const AMT_TD: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'Cross Sell (New Students)':    { bg: 'var(--green-50)',       color: 'var(--green-700)' },
  'Upsell (Existing Students)':   { bg: 'var(--green-50)',       color: 'var(--green-700)' },
  'Price Increase':               { bg: 'rgba(132,204,22,0.12)', color: '#3f6212' },
  'Flat':                         { bg: 'var(--bg-subtle)',      color: 'var(--fg-2)' },
  'Contraction':                  { bg: 'rgba(245,158,11,0.12)', color: '#92400e' },
  'Churn Risk':                   { bg: 'rgba(249,115,22,0.12)', color: '#c2410c' },
  'Churn Notice Given':           { bg: 'var(--red-50)',         color: 'var(--red-700)' },
  'Lost':                         { bg: 'rgba(153,27,27,0.12)',  color: '#7f1d1d' },
}

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  'Pending':               { bg: 'var(--bg-subtle)',          color: 'var(--fg-3)' },
  'Qualifying':            { bg: 'rgba(59,130,246,0.12)',     color: '#1d4ed8' },
  'Evaluation':            { bg: 'rgba(99,102,241,0.12)',     color: '#4338ca' },
  'Proposal':              { bg: 'rgba(139,92,246,0.12)',     color: '#6d28d9' },
  'Negotiation':           { bg: 'rgba(245,158,11,0.12)',     color: '#92400e' },
  'Closing':               { bg: 'rgba(34,197,94,0.12)',      color: '#15803d' },
  'Closed Won':            { bg: 'var(--green-50)',           color: 'var(--green-700)' },
  'Closed Lost':           { bg: 'var(--red-50)',             color: 'var(--red-700)' },
  'Closed Lost - Churned': { bg: 'var(--red-50)',             color: 'var(--red-700)' },
  'Closed - Recycle':      { bg: 'var(--bg-subtle)',          color: 'var(--fg-3)' },
}

export function TypeCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const { bg, color } = TYPE_COLORS[value] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

export function StageCell({ stage }: { stage: string }) {
  const { bg, color } = STAGE_COLORS[stage] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

export function PipelineBadge({ kind }: { kind: 'renewal' | 'expansion' }) {
  const isRenewal = kind === 'renewal'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: isRenewal ? 'var(--blue-50)' : 'var(--green-50)', color: isRenewal ? 'var(--navy-900)' : 'var(--green-700)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {isRenewal ? 'Renewal' : 'Expansion'}
    </span>
  )
}

export function LongTextCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return (
    <span style={{ color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {value}
    </span>
  )
}

export function CurrencyPairCell({ value, code, nzdValue, signed = false }: {
  value: number | null | undefined
  code: string
  nzdValue?: number | null
  signed?: boolean
}) {
  if (value == null) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  if (signed && value === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const color = signed ? (value > 0 ? 'var(--green-500)' : 'var(--red-400)') : 'var(--fg-1)'
  const emoji = signed ? (value > 0 ? '▲ ' : '▼ ') : ''
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>{emoji}{fmtCurrency(value, code)}</span>
      {nzdValue != null && (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: signed ? color : 'var(--fg-3)' }}>
          ({fmtCurrency(nzdValue, 'NZD')})
        </span>
      )}
    </span>
  )
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color: active ? 'var(--fg-1)' : 'var(--fg-3)', flexShrink: 0 }}>
      {active ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )
}

function OutcomeCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const { label, bg, fg } = outcomePill(value)
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color: fg, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function DateText({ date }: { date: string | null | undefined }) {
  if (!date) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return <span style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{shortDate(date)}</span>
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date + 'T00:00:00').getTime()) / 86_400_000)
}

// Last activity on the opp. Amber when nothing logged in the last 14 days.
function TouchedText({ date }: { date: string | null | undefined }) {
  if (!date) return <span style={{ color: '#B35C00', fontWeight: 600 }}>Never</span>
  const stale = daysSince(date) > 14
  return (
    <span style={{ whiteSpace: 'nowrap', color: stale ? '#B35C00' : 'var(--fg-2)', fontWeight: stale ? 600 : 400 }}>
      {shortDate(date)}
    </span>
  )
}

type Row =
  | { kind: 'renewal'; opp: SFRenewalOpp; sortKey: string }
  | { kind: 'expansion'; opp: SFExpansionOpp; sortKey: string }

function d(s: string | null | undefined): number { return s ? new Date(s).getTime() : 0 }

function getRowSortVal(row: Row, col: SortCol): number {
  const opp = row.opp
  switch (col) {
    case 'flags':         return row.kind === 'renewal' ? getRenewalFlags(opp as SFRenewalOpp).length : getExpansionFlags(opp as SFExpansionOpp).length
    case 'stage': { const i = STAGE_ORDER.indexOf(opp.StageName); return i === -1 ? STAGE_ORDER.length : i }
    case 'arr_basis':     return opp.ARR_Basis_NZD__c ?? opp.ARR_Basis__c ?? 0
    case 'auto_renewal':  return row.kind === 'renewal' ? ((opp as SFRenewalOpp).Auto_Renewal_Amount_NZD__c ?? (opp as SFRenewalOpp).Auto_Renewal_Amount__c ?? 0) : 0
    case 'net_arr':       return opp.Net_ARR_NZD__c ?? opp.Net_ARR__c ?? 0
    case 'close_date':    return d(opp.CloseDate)
    case 'last_meeting':  return d(opp.Last_Meeting_Date__c)
    case 'next_meeting':  return d(opp.Next_Meeting_Date__c)
    case 'last_touched':  return d(opp.LastActivityDate)
  }
}

const SPIN_KEYFRAMES = '@keyframes sql-handoff-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'

const STICKY_RIGHT_TH: React.CSSProperties = { ...TH, position: 'sticky', right: 0, zIndex: 2, boxShadow: '-2px 0 4px rgba(0,0,0,0.06)' }
const STICKY_RIGHT_TD: React.CSSProperties = { ...TD, position: 'sticky', right: 0, zIndex: 1, boxShadow: '-2px 0 4px rgba(0,0,0,0.06)' }

const ROW_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
}

function draftFrom(opp: SFRenewalOpp | SFExpansionOpp): Draft {
  return {
    StageName: opp.StageName ?? '',
    Type: opp.Type ?? '',
    Category__c: opp.Category__c ?? '',
    CloseDate: opp.CloseDate ?? '',
    NextStep: opp.NextStep ?? '',
    Expansion_Notes__c: opp.Expansion_Notes__c ?? '',
    Renewal_Risk_Notes__c: opp.Renewal_Risk_Notes__c ?? '',
    Manager_Review_Notes__c: opp.Manager_Review_Notes__c ?? '',
    Initial_Meeting_Outcome__c: opp.Initial_Meeting_Outcome__c ?? '',
  }
}

export default function AllDealsTable({ renewals, expansions, picklists = null }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Edits saved to Salesforce this session, layered over the server data until the next reload
  const [overrides, setOverrides] = useState<Overrides>({})
  // The one row being edited, with its unsaved values
  const [editing, setEditing] = useState<{ id: string; original: Draft; draft: Draft } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 8000 : 3000)
    return () => clearTimeout(t)
  }, [toast])

  function toggleSort(col: SortCol) {
    setSortCol(prev => {
      if (prev !== col) { setSortDir('desc'); return col }
      if (sortDir === 'desc') { setSortDir('asc'); return col }
      setSortDir('desc'); return null
    })
  }

  function startEdit(opp: SFRenewalOpp | SFExpansionOpp) {
    const d = draftFrom(opp)
    setEditing({ id: opp.Id, original: d, draft: d })
  }

  function setDraft(field: EditField, value: string) {
    setEditing(prev => prev && { ...prev, draft: { ...prev.draft, [field]: value } })
  }

  async function saveRow() {
    if (!editing || saving) return
    const changed = EDIT_FIELDS.filter(f => editing.draft[f] !== editing.original[f])
    if (changed.length === 0) { setEditing(null); return }
    const fields = Object.fromEntries(changed.map(f => [f, editing.draft[f]]))
    setSaving(true)
    try {
      const res = await fetch('/api/cs-pipeline/inline-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: editing.id, fields }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setToast({ message: `Not saved: ${data.error ?? `Salesforce returned ${res.status}`}`, error: true })
        return
      }
      const patch = Object.fromEntries(changed.map(f => [f, editing.draft[f] === '' ? null : editing.draft[f]]))
      setOverrides(prev => ({ ...prev, [editing.id]: { ...prev[editing.id], ...patch } }))
      setEditing(null)
      setToast({ message: 'Saved to Salesforce', error: false })
    } catch (err) {
      setToast({ message: `Not saved: ${err instanceof Error ? err.message : 'network error'}`, error: true })
    } finally {
      setSaving(false)
    }
  }

  const baseRows: Row[] = [
    ...renewals.map(o => ({ ...o, ...overrides[o.Id] }) as SFRenewalOpp).map(opp => ({ kind: 'renewal' as const, opp, sortKey: opp.CloseDate })),
    ...expansions.map(o => ({ ...o, ...overrides[o.Id] }) as SFExpansionOpp).map(opp => ({ kind: 'expansion' as const, opp, sortKey: opp.CloseDate })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const rows = sortCol === null ? baseRows : [...baseRows].sort((a, b) => {
    const diff = getRowSortVal(a, sortCol) - getRowSortVal(b, sortCol)
    return sortDir === 'desc' ? -diff : diff
  })

  const sortProps = { sortCol, sortDir }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
        No deals match the current filters.
      </div>
    )
  }

  function sortTh(col: SortCol, label: string, width: number, amount = false) {
    return (
      <th onClick={() => toggleSort(col)} style={{ ...(amount ? AMT_TH : TH), width, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: amount ? 'flex-end' : undefined }}>
          {label}<SortIcon col={col} {...sortProps} />
        </span>
      </th>
    )
  }

  const fieldStyle = { ...EDIT_FIELD, opacity: saving ? 0.6 : 1 }

  // Dropdown in edit mode. Falls back to the read-only display if this record type's values didn't load.
  function picklistEditor(row: Row, field: 'StageName' | 'Type' | 'Category__c' | 'Initial_Meeting_Outcome__c', display: React.ReactNode) {
    const options = picklists?.[row.kind]?.[field]
    if (!editing || !options || options.length === 0) return display
    const current = editing.original[field]
    // Keep the current value selectable even if it's no longer an active picklist value
    const all = current && !options.includes(current) ? [current, ...options] : options
    return (
      <select value={editing.draft[field]} onChange={e => setDraft(field, e.target.value)} disabled={saving} style={fieldStyle}>
        {(field !== 'StageName' || !current) && <option value="">—</option>}
        {all.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  function textEditor(field: TextField) {
    if (!editing) return null
    const v = editing.draft[field]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <textarea
          value={v} onChange={e => setDraft(field, e.target.value)} disabled={saving}
          maxLength={TEXT_MAX} rows={4} style={{ ...EDIT_TEXTAREA, opacity: saving ? 0.6 : 1 }}
        />
        <span style={{ fontSize: 11, color: v.length >= TEXT_MAX ? 'var(--red-700)' : 'var(--fg-3)', alignSelf: 'flex-end' }}>
          {v.length}/{TEXT_MAX}
        </span>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <style>{SPIN_KEYFRAMES}</style>
      <table style={{ width: '100%', minWidth: 3510, borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...STICKY_TH, width: 380 }}>Opportunity</th>
            {sortTh('flags', 'Flags', 80)}
            <th style={{ ...TH, width: 130 }}>Owner</th>
            <th style={{ ...TH, width: 100 }}>Record Type</th>
            <th style={{ ...TH, width: 190 }}>Type</th>
            <th style={{ ...TH, width: 150 }}>Category</th>
            {sortTh('stage', 'Stage', 160)}
            {sortTh('close_date', 'Close Date', 150)}
            {sortTh('net_arr', 'Opp Net ARR', 120, true)}
            <th style={{ ...TH, width: 170 }}>Initial Meeting Outcome</th>
            {sortTh('last_meeting', 'Last Meeting', 110)}
            {sortTh('next_meeting', 'Next Meeting', 110)}
            {sortTh('last_touched', 'Last Touched', 110)}
            <th style={{ ...TH, width: 300 }}>Next Step</th>
            <th style={{ ...TH, width: 300 }}>Expansion Notes</th>
            <th style={{ ...TH, width: 300 }}>Renewal Risk Notes</th>
            <th style={{ ...TH, width: 300 }}>Manager Review Notes</th>
            {sortTh('arr_basis', 'ARR Basis', 120, true)}
            {sortTh('auto_renewal', 'Auto Renewal Amount', 150, true)}
            <th style={{ ...STICKY_RIGHT_TH, width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const opp = row.opp
            const isRenewal = row.kind === 'renewal'
            const isEditing = editing?.id === opp.Id
            const isClosed = (isRenewal ? CLOSED_RENEWAL_STAGES : CLOSED_EXPANSION_STAGES).has(opp.StageName)
            const code = opp.CurrencyIsoCode ?? 'AUD'
            const flags = row.kind === 'renewal' ? getRenewalFlags(row.opp) : getExpansionFlags(row.opp)
            const bg = isEditing ? 'var(--blue-50)' : undefined
            const td = (style: React.CSSProperties, width: number): React.CSSProperties => ({ ...style, width, ...(bg && { background: bg }) })
            return (
              <tr key={`${isRenewal ? 'r' : 'e'}_${opp.Id}`}>
                <td style={td(STICKY_TD, 380)}>
                  <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                </td>
                <td style={td(TD, 80)}><FlagsCell flags={flags} /></td>
                <td style={{ ...td(TD, 130), color: 'var(--fg-2)' }}>{opp['Owner.Name']}</td>
                <td style={td(TD, 100)}><PipelineBadge kind={row.kind} /></td>
                <td style={td(TD, 190)}>{isEditing ? picklistEditor(row, 'Type', <TypeCell value={opp.Type} />) : <TypeCell value={opp.Type} />}</td>
                <td style={td(TD, 150)}>
                  {(() => {
                    const display = <span style={{ color: opp.Category__c ? 'var(--fg-2)' : 'var(--fg-3)', fontSize: 13 }}>{opp.Category__c ?? '—'}</span>
                    return isEditing ? picklistEditor(row, 'Category__c', display) : display
                  })()}
                </td>
                <td style={td(TD, 160)}>{isEditing ? picklistEditor(row, 'StageName', <StageCell stage={opp.StageName} />) : <StageCell stage={opp.StageName} />}</td>
                <td style={td(TD, 150)}>
                  {isEditing && editing
                    ? <input type="date" value={editing.draft.CloseDate} onChange={e => setDraft('CloseDate', e.target.value)} disabled={saving} style={fieldStyle} />
                    : <DatePill date={opp.CloseDate} noWarning={isClosed} />}
                </td>
                <td style={td(AMT_TD, 120)}><CurrencyPairCell value={opp.Net_ARR__c} code={code} nzdValue={opp.Net_ARR_NZD__c} signed /></td>
                <td style={td(TD, 170)}>
                  {isEditing
                    ? picklistEditor(row, 'Initial_Meeting_Outcome__c', <OutcomeCell value={opp.Initial_Meeting_Outcome__c} />)
                    : <OutcomeCell value={opp.Initial_Meeting_Outcome__c} />}
                </td>
                <td style={td(TD, 110)}><DateText date={opp.Last_Meeting_Date__c} /></td>
                <td style={td(TD, 110)}><DateText date={opp.Next_Meeting_Date__c} /></td>
                <td style={td(TD, 110)}><TouchedText date={opp.LastActivityDate} /></td>
                <td style={td(TD, 300)}>{isEditing ? textEditor('NextStep') : <LongTextCell value={opp.NextStep} />}</td>
                <td style={td(TD, 300)}>{isEditing ? textEditor('Expansion_Notes__c') : <LongTextCell value={opp.Expansion_Notes__c} />}</td>
                <td style={td(TD, 300)}>{isEditing ? textEditor('Renewal_Risk_Notes__c') : <LongTextCell value={opp.Renewal_Risk_Notes__c} />}</td>
                <td style={td(TD, 300)}>{isEditing ? textEditor('Manager_Review_Notes__c') : <LongTextCell value={opp.Manager_Review_Notes__c} />}</td>
                <td style={td(AMT_TD, 120)}><CurrencyPairCell value={opp.ARR_Basis__c} code={code} nzdValue={opp.ARR_Basis_NZD__c} /></td>
                <td style={td(AMT_TD, 150)}>
                  {row.kind === 'renewal'
                    ? <CurrencyPairCell value={row.opp.Auto_Renewal_Amount__c} code={code} nzdValue={row.opp.Auto_Renewal_Amount_NZD__c} />
                    : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                </td>
                <td style={td(STICKY_RIGHT_TD, 90)}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        onClick={saveRow} disabled={saving} title="Save changes to Salesforce"
                        style={{ ...ROW_BTN, border: '1px solid var(--navy-900)', background: 'var(--navy-900)', color: '#fff', cursor: saving ? 'default' : 'pointer' }}
                      >
                        {saving ? <><SpinnerIcon /> Saving</> : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(null)} disabled={saving}
                        style={{ ...ROW_BTN, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-2)', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(opp)} disabled={saving} title="Edit this deal"
                      style={{ ...ROW_BTN, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-2)', cursor: saving ? 'default' : 'pointer' }}
                    >
                      <PencilIcon /> Edit
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {toast && <Toast message={toast.message} />}
    </div>
  )
}
