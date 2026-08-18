'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { EnrichedOpportunity, ModalKind, TabKey } from '@/lib/sql-handoff/types'
import { outcomePill } from '@/lib/sql-handoff/logic'
import WarningBadge from './WarningBadge'
import ActionsMenu from './ActionsMenu'
import ExpandableText from './ExpandableText'

type ColumnKey =
  | 'title' | 'links' | 'rtype' | 'createdBy' | 'owner' | 'age' | 'outcome' | 'next' | 'last'
  | 'touched' | 'nextStep' | 'disco' | 'fup' | 'aiUpdate' | 'aiNext' | 'mgrNotes' | 'warnings' | 'actions'

interface Props {
  tab: TabKey
  rows: EnrichedOpportunity[]
  sortKey: string
  sortDir: 1 | -1
  onSort: (key: string) => void
  onAction: (kind: ModalKind, card: EnrichedOpportunity) => void
}

const CLIP: CSSProperties = { display: 'block', minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const TEXT: CSSProperties = { fontSize: 13, color: 'rgba(0,0,0,0.87)', lineHeight: '18px', ...CLIP }
const META: CSSProperties = { fontSize: 12, color: 'rgba(0,0,0,0.54)', lineHeight: '17px', ...CLIP }
const CELL: CSSProperties = { minWidth: 0, overflow: 'hidden' }
// The sticky title cell must NOT sit inside an overflow:hidden ancestor — per spec, overflow:hidden
// creates its own scroll-mechanism context, which makes position:sticky stick relative to that small
// 320px wrapper (which itself scrolls with the row) instead of the real horizontally-scrolling container.
const TITLE_CELL: CSSProperties = {
  position: 'sticky', left: 0, zIndex: 2, background: '#fff', minWidth: 0, overflow: 'hidden',
  margin: '-9px 0', padding: '9px 12px 9px 16px', boxSizing: 'border-box',
  boxShadow: '1px 0 0 0 rgba(0,0,0,0.06)', alignSelf: 'stretch', display: 'flex', alignItems: 'center',
}

const LAYOUT: Record<TabKey, ColumnKey[]> = {
  all: ['title', 'links', 'rtype', 'createdBy', 'owner', 'age', 'outcome', 'fup', 'last', 'next', 'touched', 'nextStep', 'mgrNotes', 'warnings', 'actions'],
  'no-meeting': ['title', 'links', 'rtype', 'createdBy', 'owner', 'age', 'outcome', 'next', 'touched', 'disco', 'nextStep', 'mgrNotes', 'warnings', 'actions'],
  scheduled: ['title', 'links', 'rtype', 'createdBy', 'owner', 'age', 'outcome', 'next', 'touched', 'disco', 'nextStep', 'mgrNotes', 'warnings', 'actions'],
  'outcome-required': ['title', 'links', 'rtype', 'createdBy', 'owner', 'age', 'outcome', 'last', 'next', 'touched', 'nextStep', 'mgrNotes', 'warnings', 'actions'],
  held: ['title', 'links', 'rtype', 'createdBy', 'owner', 'age', 'outcome', 'fup', 'last', 'next', 'touched', 'nextStep', 'mgrNotes', 'warnings', 'actions'],
}

const WIDTHS: Record<ColumnKey, string> = {
  title: '320px', links: '64px', rtype: '112px', createdBy: '112px', owner: '112px', age: '58px',
  outcome: '170px', next: '112px', last: '116px', touched: '116px', nextStep: '180px',
  disco: '260px', fup: '220px', aiUpdate: '250px', aiNext: '250px', mgrNotes: '220px', warnings: '92px', actions: '84px',
}

const LABELS: Record<ColumnKey, string> = {
  title: 'Opportunity', links: 'Links', rtype: 'Record Type', createdBy: 'Created By', owner: 'Owner', age: 'Age',
  outcome: 'Meeting Outcome', next: 'Next Meeting', last: 'Last Meeting', touched: 'Last Touched',
  nextStep: 'Next Steps', disco: 'Discovery Notes', fup: 'FUp Status', aiUpdate: 'AI Last Update',
  aiNext: 'AI Next Steps', mgrNotes: 'Manager Review Notes', warnings: 'Warnings', actions: 'Action',
}

const SORT_FIELD: Partial<Record<ColumnKey, string>> = {
  title: 'Name', rtype: 'Record_Type_Name__c', createdBy: 'CreatedBy.Name', owner: 'Owner.Name',
  age: 'age', outcome: 'Initial_Meeting_Outcome__c', next: 'Next_Meeting_Date__c', last: 'Last_Meeting_Date__c',
  touched: 'touchedDays', nextStep: 'NextStep', disco: 'Discovery_Notes__c', fup: 'Initial_Meeting_FUp_Email_Status__c',
  mgrNotes: 'Manager_Review_Notes__c',
  aiUpdate: 'AI_Last_Update__c', aiNext: 'AI_Next_Steps__c', warnings: 'warnCount',
}

const HELD_ORDER: { outcome: string; label: string; bg: string; fg: string }[] = [
  { outcome: 'Held - interested', label: 'Interested', bg: '#E8F5E9', fg: '#2E7D32' },
  { outcome: 'Held - deferred', label: 'Deferred', bg: '#FFF8E1', fg: '#8A6100' },
  { outcome: 'Held - not interested', label: 'Not Interested', bg: '#FDECEC', fg: '#D32F2F' },
  { outcome: 'Held - disqualified', label: 'Disqualified', bg: '#FDECEC', fg: '#D32F2F' },
  { outcome: 'Held - other', label: 'Other', bg: '#E3F2FE', fg: '#003F7F' },
]

function SalesforceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M6.5 8.5a2.5 2.5 0 0 1 4.6-1.35A2 2 0 0 1 13.5 9a2 2 0 0 1-2 2H5a2.2 2.2 0 0 1-.5-4.34A2.6 2.6 0 0 1 6.5 8.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function GongIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 5.5v5l4-2.5-4-2.5Z" fill="currentColor" />
    </svg>
  )
}

const ICON_BTN: CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 5, flexShrink: 0,
}

function RecordLinkButtons({ c }: { c: EnrichedOpportunity }): ReactNode {
  return (
    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      <a
        href={c.sfUrl} target="_blank" rel="noopener noreferrer" title="View in Salesforce"
        style={{ ...ICON_BTN, border: '1px solid #9CC9F5', background: '#e6f1fd', color: '#003F7F' }}
      >
        <SalesforceIcon />
      </a>
      <a
        href={`https://app.gong.io/go/account?crm-id=${c.Id}&crm-object-type=opportunity`} target="_blank" rel="noopener noreferrer" title="View in Gong"
        style={{ ...ICON_BTN, border: '1px solid #C9B8E8', background: '#EDE7F4', color: '#8255B1' }}
      >
        <GongIcon />
      </a>
    </span>
  )
}

function cText(t: string | null | undefined, style: CSSProperties = TEXT): ReactNode {
  return <span style={style}>{t || '—'}</span>
}

function cPill(t: string, bg: string, fg: string): ReactNode {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: bg, color: fg, ...CLIP, display: 'inline-block' }}>
      {t}
    </span>
  )
}

function cPillFull(t: string, bg: string, fg: string): ReactNode {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 100, background: bg, color: fg, display: 'inline-block', whiteSpace: 'normal', lineHeight: '15px' }}>
      {t}
    </span>
  )
}

function renderCell(key: ColumnKey, c: EnrichedOpportunity, onAction: Props['onAction']): ReactNode {
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
      const bg = rt === 'New Subscription' ? '#E3F2FE' : rt === 'Renewal' ? '#E8F5E9' : '#F5F5F5'
      const fg = rt === 'New Subscription' ? '#003F7F' : rt === 'Renewal' ? '#2E7D32' : '#434343'
      return cPill(short, bg, fg)
    }
    case 'createdBy':
      return cText(c['CreatedBy.Name'])
    case 'owner':
      return cText(c['Owner.Name'])
    case 'age': {
      const color = c.age > 30 ? '#D32F2F' : c.age > 14 ? '#B35C00' : 'rgba(0,0,0,0.87)'
      const weight = c.age > 14 ? 700 : 400
      return <span style={{ fontSize: 13, fontWeight: weight, color }}>{c.age}d</span>
    }
    case 'outcome': {
      const m = outcomePill(c.Initial_Meeting_Outcome__c)
      return cPillFull(c.Initial_Meeting_Outcome__c ?? m.label, m.bg, m.fg)
    }
    case 'next':
      return cText(c.nextLabel, META)
    case 'last':
      return cText(c.lastMeetingLabel, META)
    case 'touched': {
      const stale = c.touchedDays == null || c.touchedDays > 14
      return <span style={{ fontSize: 12, lineHeight: '17px', fontWeight: stale ? 600 : 400, color: stale ? '#B35C00' : 'rgba(0,0,0,0.54)' }}>{c.touchedLabel}</span>
    }
    case 'nextStep':
      return <ExpandableText text={c.NextStep} style={TEXT} />
    case 'disco':
      return <ExpandableText text={c.Discovery_Notes__c} style={TEXT} />
    case 'aiUpdate':
      return <ExpandableText text={c.AI_Last_Update__c} style={META} />
    case 'aiNext':
      return <ExpandableText text={c.AI_Next_Steps__c} style={META} />
    case 'mgrNotes':
      return <ExpandableText text={c.Manager_Review_Notes__c} style={TEXT} />
    case 'fup': {
      if (!c.Initial_Meeting_FUp_Email_Status__c) return cText('—', META)
      const sent = c.Initial_Meeting_FUp_Email_Status__c.startsWith('Sent')
      return cPillFull(c.Initial_Meeting_FUp_Email_Status__c, sent ? '#E8F5E9' : '#FFF3E0', sent ? '#2E7D32' : '#B35C00')
    }
    case 'warnings':
      return <WarningBadge card={c} />
    case 'actions':
      return <ActionsMenu card={c} isHeld={HELD_ORDER.some(g => g.outcome === c.Initial_Meeting_Outcome__c)} onAction={onAction} />
    default:
      return null
  }
}

function compareBy(a: EnrichedOpportunity, b: EnrichedOpportunity, key: string, dir: 1 | -1): number {
  const record = a as unknown as Record<string, unknown>
  const recordB = b as unknown as Record<string, unknown>
  let x: unknown = record[key]
  let y: unknown = recordB[key]
  if (key === 'Initial_Meeting_Outcome__c') { x = x || 'zz'; y = y || 'zz' }
  if (key === 'Next_Meeting_Date__c' || key === 'Last_Meeting_Date__c') { x = x || '9999'; y = y || '9999' }
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

export default function PipelineTable({ tab, rows, sortKey, sortDir, onSort, onAction }: Props) {
  const keys = [...LAYOUT[tab], 'spacer' as const]
  const gridTemplateColumns = keys.map(k => (k === 'spacer' ? '1fr' : WIDTHS[k])).join(' ')
  const gridStyle: CSSProperties = { display: 'grid', width: 'max-content', minWidth: '100%', boxSizing: 'border-box', gridTemplateColumns, gap: 12, alignItems: 'start' }

  const sorted = rows.slice().sort((a, b) => compareBy(a, b, sortKey, sortDir))
  const isHeldTab = tab === 'held'

  return (
    <div style={{ maxHeight: 'calc(100vh - 320px)', minHeight: 320, overflow: 'auto' }}>
      <div style={{ ...gridStyle, background: '#FAFAFA', borderBottom: '1px solid rgba(0,0,0,0.09)', padding: '10px 16px 10px 0', position: 'sticky', top: 0, zIndex: 6 }}>
        {keys.map(k => {
          if (k === 'spacer') return <span key="spacer" />
          const sortField = SORT_FIELD[k]
          const active = sortField === sortKey
          return (
            <button
              key={k}
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
        })}
      </div>

      {isHeldTab ? (
        HELD_ORDER.map(group => {
          const items = sorted.filter(c => c.Initial_Meeting_Outcome__c === group.outcome)
          if (!items.length) return null
          return (
            <div key={group.outcome}>
              <div style={{ ...gridStyle, background: group.bg, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{
                  gridColumn: '1 / -1', position: 'sticky', left: 0, display: 'flex', alignItems: 'center', gap: 8,
                  paddingLeft: 16, width: 'fit-content', maxWidth: '100%',
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: group.fg,
                }}>
                  {items.length} · {group.label}
                </div>
              </div>
              {items.map((c, i) => (
                <div key={c.Id} style={{ ...gridStyle, padding: '9px 16px 9px 0', alignItems: 'center', borderBottom: i === items.length - 1 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
                  {keys.map(k => (
                    <div key={k} style={k === 'spacer' ? undefined : k === 'title' ? TITLE_CELL : CELL}>
                      {k === 'spacer' ? null : renderCell(k, c, onAction)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })
      ) : (
        sorted.map((c, i) => (
          <div key={c.Id} style={{ ...gridStyle, padding: '9px 16px 9px 0', alignItems: 'center', borderBottom: i === sorted.length - 1 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
            {keys.map(k => (
              <div key={k} style={k === 'spacer' ? undefined : k === 'title' ? TITLE_CELL : CELL}>
                {k === 'spacer' ? null : renderCell(k, c, onAction)}
              </div>
            ))}
          </div>
        ))
      )}

      {sorted.length === 0 && (
        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'rgba(0,0,0,0.38)' }}>No opportunities</div>
      )}
    </div>
  )
}
