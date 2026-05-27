'use client'

import { useState, useRef, useEffect } from 'react'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'
import {
  getRenewalFlags, getExpansionFlags,
  OPEN_RENEWAL_STAGES, OPEN_EXPANSION_STAGES,
  HYGIENE_RULES, FLAG_SHORT_LABELS,
} from '@/lib/csHygiene'
import SalesforceLink from '@/components/ui/SalesforceLink'
import DatePill from '@/components/ui/DatePill'
import FlagsCell from './FlagsCell'
import { FS } from '@/lib/fontSizes'
import { nzd } from '@/lib/formatters'

interface Props {
  renewalOpps: SFRenewalOpp[]
  expansionOpps: SFExpansionOpp[]
  activeRep: string | null
}

const CLOSED_RENEWAL_STAGES = new Set(['Closed Won', 'Closed Lost - Churned'])

// ─── Helpers ────────────────────────────────────────────────────────────────

function currency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

const AVATAR_PALETTE = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#2563eb',
]

function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function rankLabel(i: number): React.ReactNode {
  if (i === 0) return <span title="1st">🏆</span>
  if (i === 1) return <span title="2nd">🥈</span>
  if (i === 2) return <span title="3rd">🥉</span>
  return <span style={{ color: 'var(--fg-3)', fontWeight: 600 }}>{i + 1}</span>
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: 999, flexShrink: 0,
      background: avatarColor(name), color: '#fff',
      fontWeight: 700, fontSize: 11, letterSpacing: '0.02em',
    }}>
      {initials(name)}
    </span>
  )
}

function FlagBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green-700)', fontWeight: 600, fontSize: 13 }}>
        ✓ <span>0</span>
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 26, height: 26, borderRadius: 999, padding: '0 6px',
      background: 'var(--red-50)', color: 'var(--red-700)',
      fontWeight: 700, fontSize: 13,
    }}>
      {count}
    </span>
  )
}

function HygieneBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--green-500)' : score >= 60 ? '#f59e0b' : '#ef4444'
  const textColor = score >= 80 ? 'var(--green-700)' : score >= 60 ? '#92400e' : 'var(--red-700)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: textColor, minWidth: 34, textAlign: 'right' }}>
        {score}%
      </span>
    </div>
  )
}

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

function TypeCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const { bg, color } = TYPE_COLORS[value] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
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
  'Closed - Disqualified': { bg: 'var(--bg-subtle)',          color: 'var(--fg-3)' },
}

function StageCell({ stage }: { stage: string }) {
  const { bg, color } = STAGE_COLORS[stage] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

function PipelineBadge({ kind }: { kind: 'renewal' | 'expansion' }) {
  const r = kind === 'renewal'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', background: r ? 'var(--blue-50)' : 'var(--green-50)', color: r ? 'var(--navy-900)' : 'var(--green-700)' }}>
      {r ? 'Renewal' : 'Expansion'}
    </span>
  )
}

function FlagDropdown({ available, active, onToggle }: { available: string[]; active: string[]; onToggle: (f: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = active.length === 0
    ? 'All flags'
    : active.length === 1
      ? (FLAG_SHORT_LABELS[active[0]] ?? active[0])
      : `${active.length} flags`

  const SELECT_STYLE: React.CSSProperties = {
    height: 32, padding: '0 28px 0 10px', borderRadius: 6,
    border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
    background: active.length > 0 ? 'var(--blue-50)' : 'var(--bg)',
    color: active.length > 0 ? 'var(--navy-900)' : 'var(--fg-2)',
    fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    minWidth: 120,
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={SELECT_STYLE}>
        <span>⚑ {label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: 'transform 120ms', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M3 4.5l3 3 3-3" stroke="#667085" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
          minWidth: 200, background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden',
        }}>
          {available.map(flagId => {
            const checked = active.includes(flagId)
            const rule = HYGIENE_RULES.find(r => r.id === flagId)
            return (
              <div
                key={flagId}
                onClick={() => onToggle(flagId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                  color: 'var(--fg-1)', userSelect: 'none',
                  background: checked ? 'var(--blue-50)' : 'var(--bg)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)' }}
                onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
              >
                <span style={{
                  width: 16, height: 16, flexShrink: 0, borderRadius: 3,
                  border: `1.5px solid ${checked ? 'var(--navy-900)' : 'var(--border-strong)'}`,
                  background: checked ? 'var(--navy-900)' : 'var(--bg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <span style={{ fontWeight: 500 }}>{rule?.shortLabel ?? flagId}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Data computation ────────────────────────────────────────────────────────

const TH_BASE: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', color: 'var(--fg-3)',
  fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
  letterSpacing: '0.04em', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', background: 'var(--bg-subtle)',
}
const TD_BASE: React.CSSProperties = {
  padding: '11px 14px', verticalAlign: 'middle',
  borderBottom: '1px solid var(--border-subtle)',
  ...FS.body, background: 'var(--bg)',
}
const TOTAL_TD: React.CSSProperties = {
  ...TD_BASE,
  background: 'var(--bg-subtle)',
  fontWeight: 600,
  borderTop: '2px solid var(--border)',
  borderBottom: 'none',
}

interface LeaderboardRow {
  name: string; openCount: number; flaggedCount: number; openArr: number; score: number
}

function computeLeaderboard(renewals: SFRenewalOpp[], expansions: SFExpansionOpp[]): LeaderboardRow[] {
  const map = new Map<string, { openCount: number; flaggedCount: number; openArr: number }>()
  for (const opp of renewals) {
    if (!OPEN_RENEWAL_STAGES.has(opp.StageName)) continue
    const r = map.get(opp['Owner.Name']) ?? { openCount: 0, flaggedCount: 0, openArr: 0 }
    r.openCount++
    r.openArr += opp.Booked_ARR_NZD__c ?? 0
    if (getRenewalFlags(opp).length > 0) r.flaggedCount++
    map.set(opp['Owner.Name'], r)
  }
  for (const opp of expansions) {
    if (!OPEN_EXPANSION_STAGES.has(opp.StageName)) continue
    const r = map.get(opp['Owner.Name']) ?? { openCount: 0, flaggedCount: 0, openArr: 0 }
    r.openCount++
    r.openArr += opp.Booked_ARR_NZD__c ?? 0
    if (getExpansionFlags(opp).length > 0) r.flaggedCount++
    map.set(opp['Owner.Name'], r)
  }
  return [...map.entries()]
    .map(([name, { openCount, flaggedCount, openArr }]) => ({
      name, openCount, flaggedCount, openArr,
      score: openCount > 0 ? Math.round(((openCount - flaggedCount) / openCount) * 100) : 100,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

const OPEN_STAGE_ORDER = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing']

interface StageRow {
  stage: string; total: number; flagged: number; arr: number; score: number
}

function computeStageBreakdown(renewals: SFRenewalOpp[], expansions: SFExpansionOpp[]): StageRow[] {
  return OPEN_STAGE_ORDER
    .map(stage => {
      const r = renewals.filter(o => o.StageName === stage)
      const e = expansions.filter(o => o.StageName === stage)
      const total = r.length + e.length
      const flagged =
        r.filter(o => getRenewalFlags(o).length > 0).length +
        e.filter(o => getExpansionFlags(o).length > 0).length
      const arr =
        r.reduce((s, o) => s + (o.Booked_ARR_NZD__c ?? 0), 0) +
        e.reduce((s, o) => s + (o.Booked_ARR_NZD__c ?? 0), 0)
      return { stage, total, flagged, arr, score: total > 0 ? Math.round(((total - flagged) / total) * 100) : 100 }
    })
    .filter(s => s.total > 0)
}

type FlaggedRow = {
  kind: 'renewal' | 'expansion'; id: string; name: string; owner: string;
  stage: string; closeDate: string; type: string | null; arr: number | null;
  flags: string[]; isClosed: boolean
}

function buildFlaggedList(renewals: SFRenewalOpp[], expansions: SFExpansionOpp[]): FlaggedRow[] {
  const rows: FlaggedRow[] = []
  for (const opp of renewals) {
    const flags = getRenewalFlags(opp)
    if (flags.length === 0) continue
    const isClosed = CLOSED_RENEWAL_STAGES.has(opp.StageName)
    rows.push({ kind: 'renewal', id: opp.Id, name: opp.Name, owner: opp['Owner.Name'], stage: opp.StageName, closeDate: opp.CloseDate, type: opp.Type, arr: opp.Booked_ARR_NZD__c, flags, isClosed })
  }
  for (const opp of expansions) {
    const flags = getExpansionFlags(opp)
    if (flags.length === 0) continue
    rows.push({ kind: 'expansion', id: opp.Id, name: opp.Name, owner: opp['Owner.Name'], stage: opp.StageName, closeDate: opp.CloseDate, type: opp.Type, arr: opp.Booked_ARR_NZD__c, flags, isClosed: false })
  }
  return rows.sort((a, b) => b.flags.length - a.flags.length || a.closeDate.localeCompare(b.closeDate))
}

// ─── Main component ──────────────────────────────────────────────────────────

const STICKY_TH: React.CSSProperties = { ...TH_BASE, position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }
const STICKY_TD: React.CSSProperties = { ...TD_BASE, position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }

export default function CsZeroBoard({ renewalOpps, expansionOpps, activeRep }: Props) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [activeFlags, setActiveFlags] = useState<string[]>([])

  const filteredRenewals = activeRep ? renewalOpps.filter(o => o['Owner.Name'] === activeRep) : renewalOpps
  const filteredExpansions = activeRep ? expansionOpps.filter(o => o['Owner.Name'] === activeRep) : expansionOpps

  const leaderboard = computeLeaderboard(renewalOpps, expansionOpps)
  const stageBreakdown = computeStageBreakdown(filteredRenewals, filteredExpansions)
  const flaggedList = buildFlaggedList(filteredRenewals, filteredExpansions)

  const availableFlags = HYGIENE_RULES
    .filter(r => flaggedList.some(row => row.flags.includes(r.id)))
    .map(r => r.id)

  function toggleFlag(f: string) {
    setActiveFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const displayedList = activeFlags.length > 0
    ? flaggedList.filter(row => row.flags.some(f => activeFlags.includes(f)))
    : flaggedList

  const totalArr = stageBreakdown.reduce((s, r) => s + r.arr, 0)
  const totalOpps = stageBreakdown.reduce((s, r) => s + r.total, 0)
  const totalFlagged = stageBreakdown.reduce((s, r) => s + r.flagged, 0)
  const totalScore = totalOpps > 0 ? Math.round(((totalOpps - totalFlagged) / totalOpps) * 100) : 100

  const ruleCounts = HYGIENE_RULES.map(rule => {
    let count = 0
    if (rule.appliesTo === 'renewals' || rule.appliesTo === 'both')
      count += filteredRenewals.filter(o => getRenewalFlags(o).includes(rule.id)).length
    if (rule.appliesTo === 'expansions' || rule.appliesTo === 'both')
      count += filteredExpansions.filter(o => getExpansionFlags(o).includes(rule.id)).length
    return { rule, count }
  }).filter(r => r.count > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Widgets row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>

        {/* Rep Leaderboard */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>Rep leaderboard</div>
          </div>
          {leaderboard.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-3)', ...FS.body }}>No open opportunities.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...TH_BASE, width: 36, textAlign: 'center' }}>#</th>
                  <th style={{ ...TH_BASE }}>Rep</th>
                  <th style={{ ...TH_BASE, textAlign: 'right', width: 120 }}>Total ARR (NZD)</th>
                  <th style={{ ...TH_BASE, textAlign: 'center', width: 80 }}>Open</th>
                  <th style={{ ...TH_BASE, textAlign: 'center', width: 80 }}>Flagged</th>
                  <th style={{ ...TH_BASE, width: 160 }}>Hygiene Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => {
                  return (
                    <tr key={row.name}>
                      <td style={{ ...TD_BASE, width: 36, textAlign: 'center', fontSize: 16 }}>
                        {rankLabel(i)}
                      </td>
                      <td style={{ ...TD_BASE }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={row.name} />
                          <span style={{ color: 'var(--fg-1)' }}>{row.name}</span>
                        </div>
                      </td>
                      <td style={{ ...TD_BASE, textAlign: 'right', width: 120, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: row.openArr > 0 ? 'var(--fg-1)' : 'var(--fg-3)' }}>
                        {nzd(row.openArr)}
                      </td>
                      <td style={{ ...TD_BASE, textAlign: 'center', width: 80, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.openCount}
                      </td>
                      <td style={{ ...TD_BASE, textAlign: 'center', width: 80 }}>
                        <FlagBadge count={row.flaggedCount} />
                      </td>
                      <td style={{ ...TD_BASE, width: 160 }}>
                        <HygieneBar score={row.score} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pipeline by stage */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>Pipeline by stage</div>
          </div>
          {stageBreakdown.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-3)', ...FS.body }}>
              No open opportunities.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...TH_BASE }}>Stage</th>
                  <th style={{ ...TH_BASE, textAlign: 'right', width: 120 }}>Total ARR (NZD)</th>
                  <th style={{ ...TH_BASE, textAlign: 'center', width: 60 }}>Opps</th>
                  <th style={{ ...TH_BASE, textAlign: 'center', width: 80 }}>Flagged</th>
                  <th style={{ ...TH_BASE, width: 160 }}>Hygiene Score</th>
                </tr>
              </thead>
              <tbody>
                {stageBreakdown.map(row => (
                  <tr key={row.stage}>
                    <td style={{ ...TD_BASE, color: 'var(--fg-1)' }}>{row.stage}</td>
                    <td style={{ ...TD_BASE, textAlign: 'right', width: 120, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: row.arr > 0 ? 'var(--fg-1)' : 'var(--fg-3)' }}>
                      {nzd(row.arr)}
                    </td>
                    <td style={{ ...TD_BASE, textAlign: 'center', width: 60, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.total}
                    </td>
                    <td style={{ ...TD_BASE, textAlign: 'center', width: 80 }}>
                      <FlagBadge count={row.flagged} />
                    </td>
                    <td style={{ ...TD_BASE, width: 160 }}>
                      <HygieneBar score={row.score} />
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr>
                  <td style={{ ...TOTAL_TD, color: 'var(--fg-1)' }}>Total</td>
                  <td style={{ ...TOTAL_TD, textAlign: 'right', width: 120, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-1)' }}>
                    {nzd(totalArr)}
                  </td>
                  <td style={{ ...TOTAL_TD, textAlign: 'center', width: 60, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>
                    {totalOpps}
                  </td>
                  <td style={{ ...TOTAL_TD, textAlign: 'center', width: 80 }}>
                    <FlagBadge count={totalFlagged} />
                  </td>
                  <td style={{ ...TOTAL_TD, width: 160 }}>
                    <HygieneBar score={totalScore} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rules toggle section */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setRulesOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', background: 'var(--bg-subtle)', border: 'none',
            borderBottom: rulesOpen ? '1px solid var(--border)' : 'none',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>Hygiene rules</span>
            {ruleCounts.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '1px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 11, fontWeight: 700, color: '#92400e' }}>
                {ruleCounts.length} active
              </span>
            )}
          </div>
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{rulesOpen ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {rulesOpen && (
          ruleCounts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-3)', ...FS.body }}>
              No active hygiene rules — all opportunities are clean.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...TH_BASE, width: 180 }}>Rule</th>
                  <th style={{ ...TH_BASE }}>Description</th>
                  <th style={{ ...TH_BASE, width: 80, textAlign: 'center' }}>Opps</th>
                  <th style={{ ...TH_BASE, width: 90 }}>Applies to</th>
                </tr>
              </thead>
              <tbody>
                {ruleCounts.map(({ rule, count }) => (
                  <tr key={rule.id}>
                    <td style={{ ...TD_BASE, width: 180, fontWeight: 600, color: 'var(--fg-1)' }}>{rule.label}</td>
                    <td style={{ ...TD_BASE, color: 'var(--fg-2)' }}>{rule.description}</td>
                    <td style={{ ...TD_BASE, textAlign: 'center', width: 80 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 26, borderRadius: 999, padding: '0 6px', background: 'rgba(245,158,11,0.12)', color: '#92400e', fontWeight: 700, fontSize: 13 }}>
                        {count}
                      </span>
                    </td>
                    <td style={{ ...TD_BASE, width: 90, color: 'var(--fg-3)', fontSize: 12 }}>
                      {rule.appliesTo === 'both' ? 'All' : rule.appliesTo === 'renewals' ? 'Renewals' : 'Expansions'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Zero Board flat list */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>Zero Board</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '1px 8px', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>
            {displayedList.length}{activeFlags.length > 0 ? ` / ${flaggedList.length}` : ''} deal{flaggedList.length !== 1 ? 's' : ''}
          </span>
          {availableFlags.length > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <FlagDropdown available={availableFlags} active={activeFlags} onToggle={toggleFlag} />
            </div>
          )}
        </div>

        {flaggedList.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
            No hygiene issues found — all opportunities are clean.
          </div>
        ) : displayedList.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
            No opportunities match the selected flag filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', position: 'relative' }}>
            <table style={{ width: '100%', minWidth: 1120, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...STICKY_TH, width: 280 }}>Opportunity</th>
                  <th style={{ ...TH_BASE, width: 80 }}>Flags</th>
                  <th style={{ ...TH_BASE, width: 100 }}>Pipeline</th>
                  <th style={{ ...TH_BASE, width: 130 }}>Owner</th>
                  <th style={{ ...TH_BASE, width: 130 }}>Stage</th>
                  <th style={{ ...TH_BASE, width: 120, textAlign: 'right' }}>Total ARR (NZD)</th>
                  <th style={{ ...TH_BASE, width: 140 }}>Close Date</th>
                  <th style={{ ...TH_BASE, width: 140 }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {displayedList.map(row => (
                  <tr key={`${row.kind}_${row.id}`}>
                    <td style={{ ...STICKY_TD, width: 280 }}>
                      <SalesforceLink label={row.name} opportunityId={row.id} />
                    </td>
                    <td style={{ ...TD_BASE, width: 80 }}>
                      <FlagsCell flags={row.flags} />
                    </td>
                    <td style={{ ...TD_BASE, width: 100 }}><PipelineBadge kind={row.kind} /></td>
                    <td style={{ ...TD_BASE, width: 130, color: 'var(--fg-2)' }}>{row.owner}</td>
                    <td style={{ ...TD_BASE, width: 130 }}><StageCell stage={row.stage} /></td>
                    <td style={{ ...TD_BASE, width: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--fg-1)' }}>
                      {nzd(row.arr)}
                    </td>
                    <td style={{ ...TD_BASE, width: 140 }}>
                      <DatePill date={row.closeDate} noWarning={row.isClosed} />
                    </td>
                    <td style={{ ...TD_BASE, width: 140 }}><TypeCell value={row.type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
