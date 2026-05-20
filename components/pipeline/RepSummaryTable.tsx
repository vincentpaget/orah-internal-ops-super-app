'use client'

import { useRouter } from 'next/navigation'
import type { RepRow } from '@/lib/types'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'

interface Props {
  rows: RepRow[]
  activeRepId?: string
  period?: string
}

const AVATAR_PALETTE: Array<[string, string]> = [
  ['#0265c7', '#e6f1fd'],
  ['#067b31', '#e9f5ed'],
  ['#b56412', '#fff1e0'],
  ['#5a2ea6', '#f3ecfb'],
  ['#93284a', '#fce7ec'],
  ['#0a4773', '#e6ecf0'],
]

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name, index }: { name: string; index: number }) {
  const [fg, bg] = AVATAR_PALETTE[index % AVATAR_PALETTE.length]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 999,
      background: bg, color: fg,
      fontWeight: 700, ...FS.label, flexShrink: 0,
    }}>
      {initials(name)}
    </span>
  )
}

function HealthBar({ pct }: { pct: number }) {
  const tone =
    pct >= 80 ? { fill: 'var(--green-500)', fg: 'var(--green-700)' } :
    pct >= 60 ? { fill: 'var(--orange-400)', fg: 'var(--orange-700)' } :
               { fill: 'var(--red-400)',    fg: 'var(--red-700)' }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: 160, justifyContent: 'flex-end' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-canvas)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tone.fill, borderRadius: 999 }} />
      </div>
      <span style={{
        fontVariantNumeric: 'tabular-nums', ...FS.body,
        color: tone.fg, fontWeight: 600, minWidth: 40, textAlign: 'right',
      }}>
        {pct}%
      </span>
    </div>
  )
}

function FlaggedCount({ n }: { n: number }) {
  if (n === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--green-700)', fontWeight: 600 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        0
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 24, height: 22, padding: '0 8px', borderRadius: 999,
      background: 'var(--red-50)', color: 'var(--red-700)',
      fontWeight: 700, ...FS.body,
    }}>
      {n}
    </span>
  )
}

const TH: React.CSSProperties = {
  padding: '10px 16px',
  color: 'var(--fg-3)', fontWeight: 600, ...FS.badge,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  background: 'transparent',
}

export default function RepSummaryTable({ rows, activeRepId, period }: Props) {
  const router = useRouter()

  if (rows.length === 0) {
    return <p style={{ ...FS.base, color: 'var(--fg-3)', fontStyle: 'italic' }}>No reps with pipeline this quarter.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, ...FS.base }}>
        <thead>
          <tr>
            <th style={{ ...TH, ...COL.rank, textAlign: 'right', paddingRight: 8 }}>#</th>
            <th style={{ ...TH, minWidth: 160, textAlign: 'left' }}>Rep</th>
            <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>Pipeline ARR</th>
            <th style={{ ...TH, ...COL.count, textAlign: 'right' }}>Open Opps</th>
            <th style={{ ...TH, ...COL.count, textAlign: 'right' }}>Flagged</th>
            <th style={{ ...TH, ...COL.healthScore, textAlign: 'right' }}>Hygiene Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isActive = row.repId === activeRepId
            const rankLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)
            return (
              <tr
                key={row.repId}
                onClick={() => router.push(`/pipeline?rep=${row.repId}${period ? `&period=${period}` : ''}`)}
                style={{
                  cursor: 'pointer',
                  background: isActive ? 'var(--blue-50)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--navy-900)' : 'transparent'}`,
                  transition: 'background 120ms',
                }}
              >
                <td style={{ padding: '14px 8px 14px 13px', textAlign: 'right', verticalAlign: 'middle', borderBottom: '1px solid var(--border-subtle)', color: i < 3 ? 'unset' : 'var(--fg-3)', fontWeight: i < 3 ? 'unset' : 500, ...(i < 3 ? FS.heading : FS.body) }}>
                  {rankLabel}
                </td>
                <td style={{ padding: '14px 16px 14px 8px', verticalAlign: 'middle', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={row.repName} index={i} />
                    <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{row.repName}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--fg-1)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                  {nzd(row.pipelineARR)}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                  {row.openOpps}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                  <FlaggedCount n={row.flaggedCount} />
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                  <HealthBar pct={row.healthPct} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
