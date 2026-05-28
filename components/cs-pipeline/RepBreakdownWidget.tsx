'use client'

import { Fragment, useState } from 'react'
import type { SFRenewalOpp } from '@/lib/types'
import { getRenewalFlags } from '@/lib/csHygiene'
import { fmtCurrency } from '@/lib/formatters'

const OPEN_STAGES = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'] as const
type OpenStage = typeof OPEN_STAGES[number]
const OPEN_STAGE_SET = new Set<string>(OPEN_STAGES)

interface StageStats { count: number; arrBasis: number; oppArr: number; oppNetArr: number }

interface RepRow {
  rep: string
  total: number
  pendingAuto: number
  inProgress: number
  doNotAuto: number
  flaggedAuto: number
  byStage: Record<OpenStage, StageStats>
}

function emptyByStage(): Record<OpenStage, StageStats> {
  return Object.fromEntries(
    OPEN_STAGES.map(s => [s, { count: 0, arrBasis: 0, oppArr: 0, oppNetArr: 0 }])
  ) as Record<OpenStage, StageStats>
}

function computeRows(opps: SFRenewalOpp[]): RepRow[] {
  const map = new Map<string, RepRow>()
  for (const opp of opps) {
    if (!OPEN_STAGE_SET.has(opp.StageName)) continue
    const rep = opp['Owner.Name'] ?? 'Unknown'
    if (!map.has(rep)) {
      map.set(rep, { rep, total: 0, pendingAuto: 0, inProgress: 0, doNotAuto: 0, flaggedAuto: 0, byStage: emptyByStage() })
    }
    const row = map.get(rep)!
    row.total++
    if (opp.StageName === 'Pending' && opp.Do_Not_Auto_Renew__c === false) {
      row.pendingAuto++
      if (getRenewalFlags(opp).length > 0) row.flaggedAuto++
    }
    if (opp.StageName !== 'Pending') row.inProgress++
    if (opp.Do_Not_Auto_Renew__c === true) row.doNotAuto++
    const ss = row.byStage[opp.StageName as OpenStage]
    ss.count++
    ss.arrBasis += opp.ARR_Basis_NZD__c ?? 0
    ss.oppArr += opp.Booked_ARR_NZD__c ?? 0
    ss.oppNetArr += opp.Net_ARR_NZD__c ?? 0
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function sumRows(rows: RepRow[]): RepRow {
  return {
    rep: 'All Reps',
    total: rows.reduce((s, r) => s + r.total, 0),
    pendingAuto: rows.reduce((s, r) => s + r.pendingAuto, 0),
    inProgress: rows.reduce((s, r) => s + r.inProgress, 0),
    doNotAuto: rows.reduce((s, r) => s + r.doNotAuto, 0),
    flaggedAuto: rows.reduce((s, r) => s + r.flaggedAuto, 0),
    byStage: Object.fromEntries(
      OPEN_STAGES.map(stage => [stage, {
        count: rows.reduce((s, r) => s + r.byStage[stage].count, 0),
        arrBasis: rows.reduce((s, r) => s + r.byStage[stage].arrBasis, 0),
        oppArr: rows.reduce((s, r) => s + r.byStage[stage].oppArr, 0),
        oppNetArr: rows.reduce((s, r) => s + r.byStage[stage].oppNetArr, 0),
      }])
    ) as Record<OpenStage, StageStats>,
  }
}

const BASE_TH: React.CSSProperties = {
  padding: '8px 12px',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'var(--bg-subtle)',
}
const TH: React.CSSProperties = { ...BASE_TH, textAlign: 'left' }
const NUM_TH: React.CSSProperties = { ...BASE_TH, textAlign: 'right' }

const BASE_TD: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 13,
  whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = { ...BASE_TD, color: 'var(--fg-1)', background: 'var(--bg)' }
const NUM_TD: React.CSSProperties = { ...BASE_TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-1)', background: 'var(--bg)' }

const STICKY_TH: React.CSSProperties = {
  ...TH, position: 'sticky', left: 0, zIndex: 2,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}
const STICKY_TD: React.CSSProperties = {
  ...TD, position: 'sticky', left: 0, zIndex: 1,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}

const STAGE_BG: Record<string, string> = {
  Pending: 'var(--bg-subtle)',
  Qualifying: 'rgba(59,130,246,0.07)',
  Evaluation: 'rgba(99,102,241,0.07)',
  Proposal: 'rgba(139,92,246,0.07)',
  Negotiation: 'rgba(245,158,11,0.07)',
  Closing: 'rgba(34,197,94,0.07)',
}

function Num({ n }: { n: number }) {
  return n === 0 ? <span style={{ color: 'var(--fg-3)' }}>—</span> : <>{n}</>
}

function Amt({ v }: { v: number }) {
  if (v === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return (
    <span style={{ fontWeight: 600, color: v < 0 ? 'var(--red-400)' : 'var(--fg-1)' }}>
      {fmtCurrency(Math.round(v), 'NZD')}
    </span>
  )
}

function DataRow({ row, isTotal }: { row: RepRow; isTotal?: boolean }) {
  const bg = isTotal ? 'var(--bg-subtle)' : 'var(--bg)'
  const fw = isTotal ? 600 : undefined
  const bt = isTotal ? ('2px solid var(--border)' as const) : undefined

  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    ...NUM_TD, background: bg, fontWeight: fw, borderTop: bt, ...extra,
  })

  return (
    <>
      <td style={{ ...STICKY_TD, background: bg, fontWeight: fw, borderTop: bt, color: 'var(--fg-1)' }}>
        {row.rep}
      </td>
      <td style={cell({ borderLeft: '1px solid var(--border)' })}>{row.total}</td>
      <td style={cell()}><Num n={row.pendingAuto} /></td>
      <td style={cell()}><Num n={row.inProgress} /></td>
      <td style={cell()}><Num n={row.doNotAuto} /></td>
      <td style={cell()}><Num n={row.flaggedAuto} /></td>
      {OPEN_STAGES.map(stage => {
        const ss = row.byStage[stage]
        const stageBg = isTotal ? 'var(--bg-subtle)' : STAGE_BG[stage]
        const sc = (extra?: React.CSSProperties): React.CSSProperties => ({
          ...NUM_TD, background: stageBg, fontWeight: fw, borderTop: bt, ...extra,
        })
        return (
          <Fragment key={stage}>
            <td style={sc({ borderLeft: '1px solid var(--border)' })}><Num n={ss.count} /></td>
            <td style={sc()}><Amt v={ss.arrBasis} /></td>
            <td style={sc()}><Amt v={ss.oppArr} /></td>
            <td style={sc()}><Amt v={ss.oppNetArr} /></td>
          </Fragment>
        )
      })}
    </>
  )
}

export default function RepBreakdownWidget({ opps }: { opps: SFRenewalOpp[] }) {
  const [open, setOpen] = useState(true)
  const rows = computeRows(opps)
  const totals = sumRows(rows)

  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : undefined,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>By Rep</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 2800, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...STICKY_TH, verticalAlign: 'bottom', width: 150 }}>Rep</th>
                <th colSpan={5} style={{ ...TH, textAlign: 'center', borderLeft: '1px solid var(--border)' }}>Summary</th>
                {OPEN_STAGES.map(stage => (
                  <th
                    key={stage}
                    colSpan={4}
                    style={{ ...TH, textAlign: 'center', borderLeft: '1px solid var(--border)', background: STAGE_BG[stage] }}
                  >
                    {stage}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{ ...NUM_TH, width: 70, borderLeft: '1px solid var(--border)' }}>Total</th>
                <th style={{ ...NUM_TH, width: 100 }}>Pending Auto</th>
                <th style={{ ...NUM_TH, width: 90 }}>In Progress</th>
                <th style={{ ...NUM_TH, width: 90 }}>Do Not Auto</th>
                <th style={{ ...NUM_TH, width: 80 }}>Flagged</th>
                {OPEN_STAGES.map(stage => (
                  <Fragment key={stage}>
                    <th style={{ ...NUM_TH, width: 50, borderLeft: '1px solid var(--border)', background: STAGE_BG[stage] }}>#</th>
                    <th style={{ ...NUM_TH, width: 110, background: STAGE_BG[stage] }}>ARR Basis</th>
                    <th style={{ ...NUM_TH, width: 100, background: STAGE_BG[stage] }}>OPP ARR</th>
                    <th style={{ ...NUM_TH, width: 110, background: STAGE_BG[stage] }}>Net ARR</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.rep}>
                  <DataRow row={row} />
                </tr>
              ))}
              <tr>
                <DataRow row={totals} isTotal />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
