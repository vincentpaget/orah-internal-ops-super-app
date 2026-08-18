'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { EnrichedOpportunity, ModalKind } from '@/lib/sql-handoff/types'
import { NURTURE_BUCKET_ORDER, NURTURE_REASON_TOOLTIP, nurtureBucket, meetingLabel, moneyWithCurrency } from '@/lib/sql-handoff/logic'
import type { NurtureTabKey } from '@/lib/sql-handoff/logic'
import WarningBadge from './WarningBadge'
import ExpandableText from './ExpandableText'
import InfoTooltip from './InfoTooltip'
import { RecordLinkButtons } from './PipelineTable'
import { PencilIcon, SpinnerIcon, CheckIcon, XIcon, ICON_BTN, EDIT_FIELD, EDIT_TEXTAREA } from './InlineEditKit'

type ColumnKey = 'title' | 'links' | 'rtype' | 'owner' | 'amount' | 'createdBy' | 'reengage' | 'reason' | 'nextStep' | 'last' | 'next' | 'touched' | 'mgrNotes' | 'warnings' | 'edit'

interface InlineDraft {
  reengage: string
  nurtureReason: string
  nextStep: string
  managerReviewNotes: string
}

interface RowEditCtx {
  isEditing: boolean
  draft: InlineDraft
  saving: boolean
  onDraftChange: (field: keyof InlineDraft, value: string) => void
  onStart: () => void
  onCancel: () => void
  onSave: () => void
}

interface Props {
  tab: NurtureTabKey
  rows: EnrichedOpportunity[]
  sortKey: string
  sortDir: 1 | -1
  onSort: (key: string) => void
  onInlineSave: (card: EnrichedOpportunity, patch: InlineDraft) => Promise<boolean>
  onAction: (kind: ModalKind, card: EnrichedOpportunity) => void
}

const CLIP: CSSProperties = { display: 'block', minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const TEXT: CSSProperties = { fontSize: 13, color: 'rgba(0,0,0,0.87)', lineHeight: '18px', ...CLIP }
const META: CSSProperties = { fontSize: 12, color: 'rgba(0,0,0,0.54)', lineHeight: '17px', ...CLIP }
const CELL: CSSProperties = { minWidth: 0, overflow: 'hidden' }
const TITLE_CELL: CSSProperties = {
  position: 'sticky', left: 0, zIndex: 2, background: '#fff', minWidth: 0, overflow: 'hidden',
  margin: '-9px 0', padding: '9px 12px 9px 16px', boxSizing: 'border-box',
  boxShadow: '1px 0 0 0 rgba(0,0,0,0.06)', alignSelf: 'stretch', display: 'flex', alignItems: 'center',
}

const KEYS: ColumnKey[] = ['title', 'links', 'rtype', 'createdBy', 'owner', 'amount', 'reengage', 'reason', 'nextStep', 'last', 'next', 'touched', 'mgrNotes', 'warnings', 'edit']

const WIDTHS: Record<ColumnKey, string> = {
  title: '280px', links: '64px', rtype: '110px', createdBy: '112px', owner: '112px', amount: '104px',
  reengage: '160px', reason: '240px', nextStep: '200px', last: '116px', next: '116px', touched: '116px',
  mgrNotes: '220px', warnings: '92px', edit: '56px',
}

const LABELS: Record<ColumnKey, string> = {
  title: 'Opportunity', links: 'Links', rtype: 'Record Type', owner: 'Owner', createdBy: 'Created By', amount: 'Amount (Net ARR)',
  reengage: 'Re-engagement Date', reason: 'Nurturing Reason',
  nextStep: 'Next Step', last: 'Last Meeting', next: 'Next Meeting', touched: 'Last Activity',
  mgrNotes: 'Manager Review Notes', warnings: 'Warnings', edit: '',
}

const SORT_FIELD: Partial<Record<ColumnKey, string>> = {
  title: 'Name', rtype: 'Record_Type_Name__c', owner: 'Owner.Name', createdBy: 'CreatedBy.Name', amount: 'Amount',
  reengage: 'Re_engagement_Date__c',
  nextStep: 'NextStep', last: 'Last_Meeting_Date__c', next: 'Next_Meeting_Date__c', touched: 'touchedDays',
  mgrNotes: 'Manager_Review_Notes__c', warnings: 'warnCount',
}

function cText(t: string | null | undefined, style: CSSProperties = TEXT): ReactNode {
  return <span style={style}>{t || '—'}</span>
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function renderCell(key: ColumnKey, c: EnrichedOpportunity, editCtx: RowEditCtx, onAction: Props['onAction']): ReactNode {
  const isEditingRow = editCtx.isEditing
  switch (key) {
    case 'title':
      return (
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#262626', lineHeight: '18px', width: '100%',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal',
        }}>
          {c.Name}
        </span>
      )
    case 'links':
      return <RecordLinkButtons c={c} />
    case 'rtype': {
      const rt = c.Record_Type_Name__c
      const short = rt === 'New Subscription' ? 'New Sub' : rt === 'Expansion (Mid-Term)' ? 'Expansion' : (rt ?? '—')
      return (
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: '#F5F5F5', color: '#434343', ...CLIP, display: 'inline-block' }}>
          {short}
        </span>
      )
    }
    case 'owner':
      return cText(c['Owner.Name'])
    case 'amount':
      return c.Amount == null ? cText('—', META) : <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.87)' }}>{moneyWithCurrency(c.Amount, c.CurrencyIsoCode)}</span>
    case 'createdBy':
      return cText(c['CreatedBy.Name'])
    case 'reengage': {
      if (isEditingRow) {
        return (
          <input
            type="date" value={editCtx.draft.reengage} onChange={e => editCtx.onDraftChange('reengage', e.target.value)}
            disabled={editCtx.saving} style={{ ...EDIT_FIELD, opacity: editCtx.saving ? 0.6 : 1 }}
          />
        )
      }
      if (!c.Re_engagement_Date__c) return cText('—', META)
      const bucket = nurtureBucket(c)
      const overdue = bucket === 'overdue'
      return <span style={{ fontSize: 13, fontWeight: overdue ? 700 : 400, color: overdue ? '#D32F2F' : 'rgba(0,0,0,0.87)' }}>{meetingLabel(c.Re_engagement_Date__c)}</span>
    }
    case 'reason':
      if (isEditingRow) {
        return (
          <textarea
            value={editCtx.draft.nurtureReason} onChange={e => editCtx.onDraftChange('nurtureReason', e.target.value)}
            disabled={editCtx.saving} style={{ ...EDIT_TEXTAREA, opacity: editCtx.saving ? 0.6 : 1 }} rows={3}
          />
        )
      }
      return <ExpandableText text={c.Nurturing_Reason__c} style={TEXT} />
    case 'last':
      return cText(c.lastMeetingLabel, META)
    case 'next':
      return cText(c.nextLabel, META)
    case 'touched': {
      const stale = c.touchedDays == null || c.touchedDays > 14
      return <span style={{ fontSize: 12, lineHeight: '17px', fontWeight: stale ? 600 : 400, color: stale ? '#B35C00' : 'rgba(0,0,0,0.54)' }}>{c.touchedLabel}</span>
    }
    case 'nextStep':
      if (isEditingRow) {
        return (
          <textarea
            value={editCtx.draft.nextStep} onChange={e => editCtx.onDraftChange('nextStep', e.target.value)}
            disabled={editCtx.saving} style={{ ...EDIT_TEXTAREA, opacity: editCtx.saving ? 0.6 : 1 }} rows={3}
          />
        )
      }
      return <ExpandableText text={c.NextStep} style={TEXT} />
    case 'mgrNotes':
      if (isEditingRow) {
        return (
          <textarea
            value={editCtx.draft.managerReviewNotes} onChange={e => editCtx.onDraftChange('managerReviewNotes', e.target.value)}
            disabled={editCtx.saving} style={{ ...EDIT_TEXTAREA, opacity: editCtx.saving ? 0.6 : 1 }} rows={3}
          />
        )
      }
      return <ExpandableText text={c.Manager_Review_Notes__c} style={TEXT} />
    case 'warnings':
      return <WarningBadge card={c} />
    case 'edit':
      if (isEditingRow) {
        return (
          <span style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => editCtx.onSave()} disabled={editCtx.saving} title={editCtx.saving ? 'Saving…' : 'Save'}
              style={{
                ...ICON_BTN, border: '1px solid #9CD8A8', background: '#E8F5E9', color: '#2E7D32',
                cursor: editCtx.saving ? 'default' : 'pointer',
              }}
            >
              {editCtx.saving ? <SpinnerIcon /> : <CheckIcon />}
            </button>
            <button
              onClick={editCtx.onCancel} disabled={editCtx.saving} title="Cancel"
              style={{
                ...ICON_BTN, border: '1px solid #E0E0E0', background: '#fff', color: 'rgba(0,0,0,0.54)',
                cursor: editCtx.saving ? 'default' : 'pointer', opacity: editCtx.saving ? 0.5 : 1,
              }}
            >
              <XIcon />
            </button>
          </span>
        )
      }
      return (
        <span style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => editCtx.onStart()} title="Quick edit"
            style={{ ...ICON_BTN, border: '1px solid #E0E0E0', background: '#fff', color: 'rgba(0,0,0,0.54)', cursor: 'pointer' }}
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onAction('edit', c)} title="View/Edit"
            style={{ ...ICON_BTN, border: '1px solid #9CC9F5', background: '#e6f1fd', color: '#003F7F', cursor: 'pointer' }}
          >
            <EyeIcon />
          </button>
        </span>
      )
    default:
      return null
  }
}

function compareBy(a: EnrichedOpportunity, b: EnrichedOpportunity, key: string, dir: 1 | -1): number {
  const record = a as unknown as Record<string, unknown>
  const recordB = b as unknown as Record<string, unknown>
  let x: unknown = record[key]
  let y: unknown = recordB[key]
  if (key === 'Re_engagement_Date__c') { x = x || '9999'; y = y || '9999' }
  if (typeof x === 'string') x = x.toLowerCase()
  if (typeof y === 'string') y = y.toLowerCase()
  if (x == null) x = ''
  if (y == null) y = ''
  const xVal = x as string | number
  const yVal = y as string | number
  if (xVal < yVal) return -dir
  if (xVal > yVal) return dir
  return 0
}

export default function NurturingTable({ tab, rows, sortKey, sortDir, onSort, onInlineSave, onAction }: Props) {
  const keys = [...KEYS, 'spacer' as const]
  const gridTemplateColumns = keys.map(k => (k === 'spacer' ? '1fr' : WIDTHS[k])).join(' ')
  const gridStyle: CSSProperties = { display: 'grid', width: 'max-content', minWidth: '100%', boxSizing: 'border-box', gridTemplateColumns, gap: 12, alignItems: 'start' }

  const sorted = rows.slice().sort((a, b) => compareBy(a, b, sortKey, sortDir))
  const isAllTab = tab === 'all'

  // Keyed by opportunity Id so any number of rows can be in edit mode at once.
  const [drafts, setDrafts] = useState<Record<string, InlineDraft>>({})
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})

  function getEditCtx(c: EnrichedOpportunity): RowEditCtx {
    const draft = drafts[c.Id]
    return {
      isEditing: draft !== undefined,
      draft: draft ?? { reengage: '', nurtureReason: '', nextStep: '', managerReviewNotes: '' },
      saving: !!savingIds[c.Id],
      onDraftChange: (field, value) => setDrafts(prev => ({ ...prev, [c.Id]: { ...prev[c.Id], [field]: value } })),
      onStart: () => setDrafts(prev => ({
        ...prev,
        [c.Id]: {
          reengage: c.Re_engagement_Date__c ?? '',
          nurtureReason: c.Nurturing_Reason__c ?? '',
          nextStep: c.NextStep ?? '',
          managerReviewNotes: c.Manager_Review_Notes__c ?? '',
        },
      })),
      onCancel: () => setDrafts(prev => {
        const next = { ...prev }
        delete next[c.Id]
        return next
      }),
      onSave: async () => {
        const current = drafts[c.Id]
        if (!current) return
        setSavingIds(prev => ({ ...prev, [c.Id]: true }))
        const ok = await onInlineSave(c, current)
        setSavingIds(prev => {
          const next = { ...prev }
          delete next[c.Id]
          return next
        })
        if (ok) {
          setDrafts(prev => {
            const next = { ...prev }
            delete next[c.Id]
            return next
          })
        }
      },
    }
  }

  return (
    <div style={{ maxHeight: 'calc(100vh - 320px)', minHeight: 320, overflow: 'auto' }}>
      <div style={{ ...gridStyle, background: '#FAFAFA', borderBottom: '1px solid rgba(0,0,0,0.09)', padding: '10px 16px 10px 0', position: 'sticky', top: 0, zIndex: 6 }}>
        {keys.map(k => {
          if (k === 'spacer') return <span key="spacer" />
          const sortField = SORT_FIELD[k]
          const active = sortField === sortKey
          const button = (
            <button
              key={k === 'reason' ? undefined : k}
              onClick={() => sortField && onSort(sortField)}
              style={{
                textAlign: 'left', border: 'none', fontFamily: "'Open Sans', sans-serif", fontSize: 11,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: active ? '#0073E6' : '#9E9E9E', cursor: sortField ? 'pointer' : 'default',
                ...(k === 'title'
                  ? { position: 'sticky', left: 0, zIndex: 3, background: '#FAFAFA', margin: '-10px 0', padding: '10px 12px 10px 16px', alignSelf: 'stretch' }
                  : { background: 'transparent', padding: 0 }),
              }}
            >
              {LABELS[k]}{active ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
            </button>
          )
          if (k === 'reason') {
            return (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {button}
                <InfoTooltip text={NURTURE_REASON_TOOLTIP} />
              </span>
            )
          }
          return button
        })}
      </div>

      {isAllTab ? (
        NURTURE_BUCKET_ORDER.map(group => {
          const items = sorted.filter(c => nurtureBucket(c) === group.key)
          if (!items.length) return null
          return (
            <div key={group.key}>
              <div style={{ ...gridStyle, background: group.bg, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{
                  gridColumn: '1 / -1', position: 'sticky', left: 0, display: 'flex', alignItems: 'center', gap: 8,
                  paddingLeft: 16, width: 'fit-content', maxWidth: '100%',
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: group.fg,
                }}>
                  {items.length} · {group.label}
                </div>
              </div>
              {items.map((c, i) => {
                const editCtx = getEditCtx(c)
                return (
                  <div key={c.Id} style={{ ...gridStyle, padding: '9px 16px 9px 0', alignItems: 'center', borderBottom: i === items.length - 1 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
                    {keys.map(k => (
                      <div key={k} style={k === 'spacer' ? undefined : k === 'title' ? TITLE_CELL : CELL}>
                        {k === 'spacer' ? null : renderCell(k, c, editCtx, onAction)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })
      ) : (
        sorted.map((c, i) => {
          const editCtx = getEditCtx(c)
          return (
            <div key={c.Id} style={{ ...gridStyle, padding: '9px 16px 9px 0', alignItems: 'center', borderBottom: i === sorted.length - 1 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
              {keys.map(k => (
                <div key={k} style={k === 'spacer' ? undefined : k === 'title' ? TITLE_CELL : CELL}>
                  {k === 'spacer' ? null : renderCell(k, c, editCtx, onAction)}
                </div>
              ))}
            </div>
          )
        })
      )}

      {sorted.length === 0 && (
        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'rgba(0,0,0,0.38)' }}>No nurturing opportunities</div>
      )}
    </div>
  )
}
