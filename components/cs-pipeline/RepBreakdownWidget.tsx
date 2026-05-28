'use client'

import { useState } from 'react'
import type { SFRenewalOpp } from '@/lib/types'
import { getRenewalFlags } from '@/lib/csHygiene'
import { fmtCurrency } from '@/lib/formatters'

const OPEN_STAGES = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'] as const
type OpenStage = typeof OPEN_STAGES[number]
const OPEN_STAGE_SET = new Set<string>(OPEN_STAGES)

// ── Data types ──────────────────────────────────────────────────────────────

interface RepRow {
  rep: string
  total: number
  pendingAuto: number
  inProgress: number
  doNotAuto: number
  flaggedAuto: number
}

interface StageRow {
  stage: OpenStage
  count: number
  arrBasis: number
  oppArr: number
  oppNetArr: number
}

// ── Computation ──────────────────────────────────────────────────────────────

function computeRepRows(opps: SFRenewalOpp[]): RepRow[] {
  const map = new Map<string, RepRow>()
  for (const opp of opps) {
    if (!OPEN_STAGE_SET.has(opp.StageName)) continue
    const rep = opp['Owner.Name'] ?? 'Unknown'
    if (!map.has(rep)) map.set(rep, { rep, total: 0, pendingAuto: 0, inProgress: 0, doNotAuto: 0, flaggedAuto: 0 })
    const row = map.get(rep)!
    row.total++
    if (opp.StageName === 'Pending' && opp.Do_Not_Auto_Renew__c === false) {
      row.pendingAuto++
      if (getRenewalFlags(opp).length > 0) row.flaggedAuto++
    }
    if (opp.StageName !== 'Pending') row.inProgress++
    if (opp.Do_Not_Auto_Renew__c === true) row.doNotAuto++
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function computeStageRows(opps: SFRenewalOpp[]): StageRow[] {
  const map = new Map<OpenStage, StageRow>(
    OPEN_STAGES.map(s => [s, { stage: s, count: 0, arrBasis: 0, oppArr: 0, oppNetArr: 0 }])
  )
  for (const opp of opps) {
    const row = map.get(opp.StageName as OpenStage)
    if (!row) continue
    row.count++
    row.arrBasis += opp.ARR_Basis_NZD__c ?? 0
    row.oppArr += opp.Booked_ARR_NZD__c ?? 0
    row.oppNetArr += opp.Net_ARR_NZD__c ?? 0
  }
  return OPEN_STAGES.map(s => map.get(s)!)
}

// ── Shared styles ────────────────────────────────────────────────────────────

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
  background: 'var(--bg)',
}
const TD: React.CSSProperties = { ...BASE_TD, color: 'var(--fg-1)' }
const NUM_TD: React.CSSProperties = { ...BASE_TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-1)' }
const TOTAL_TD: React.CSSProperties = { ...NUM_TD, fontWeight: 600, background: 'var(--bg-subtle)', borderTop: '2px solid var(--border)' }
const TOTAL_LABEL_TD: React.CSSProperties = { ...TD, fontWeight: 600, background: 'var(--bg-subtle)', borderTop: '2px solid var(--border)', color: 'var(--fg-2)' }

const STAGE_BG: Record<string, string> = {
  Pending: 'var(--bg-subtle)',
  Qualifying: 'rgba(59,130,246,0.07)',
  Evaluation: 'rgba(99,102,241,0.07)',
  Proposal: 'rgba(139,92,246,0.07)',
  Negotiation: 'rgba(245,158,11,0.07)',
  Closing: 'rgba(34,197,94,0.07)',
}

function InnerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', overflow: 'hidden', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
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

// ── By Rep card ──────────────────────────────────────────────────────────────

function RepCard({ opps }: { opps: SFRenewalOpp[] }) {
  const rows = computeRepRows(opps)
  const totals: RepRow = {
    rep: 'All Reps',
    total: rows.reduce((s, r) => s + r.total, 0),
    pendingAuto: rows.reduce((s, r) => s + r.pendingAuto, 0),
    inProgress: rows.reduce((s, r) => s + r.inProgress, 0),
    doNotAuto: rows.reduce((s, r) => s + r.doNotAuto, 0),
    flaggedAuto: rows.reduce((s, r) => s + r.flaggedAuto, 0),
  }

  return (
    <InnerCard title="By Rep">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 150 }}>Rep</th>
            <th style={{ ...NUM_TH, width: 70 }}>Total</th>
            <th style={{ ...NUM_TH, width: 110 }}>Pending Auto</th>
            <th style={{ ...NUM_TH, width: 100 }}>In Progress</th>
            <th style={{ ...NUM_TH, width: 100 }}>Do Not Auto</th>
            <th style={{ ...NUM_TH, width: 90 }}>Flagged</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.rep}>
              <td style={TD}>{row.rep}</td>
              <td style={NUM_TD}>{row.total}</td>
              <td style={NUM_TD}><Num n={row.pendingAuto} /></td>
              <td style={NUM_TD}><Num n={row.inProgress} /></td>
              <td style={NUM_TD}><Num n={row.doNotAuto} /></td>
              <td style={NUM_TD}><Num n={row.flaggedAuto} /></td>
            </tr>
          ))}
          <tr>
            <td style={TOTAL_LABEL_TD}>{totals.rep}</td>
            <td style={TOTAL_TD}>{totals.total}</td>
            <td style={TOTAL_TD}><Num n={totals.pendingAuto} /></td>
            <td style={TOTAL_TD}><Num n={totals.inProgress} /></td>
            <td style={TOTAL_TD}><Num n={totals.doNotAuto} /></td>
            <td style={TOTAL_TD}><Num n={totals.flaggedAuto} /></td>
          </tr>
        </tbody>
      </table>
    </InnerCard>
  )
}

// ── By Stage card ────────────────────────────────────────────────────────────

function StageCard({ opps }: { opps: SFRenewalOpp[] }) {
  const rows = computeStageRows(opps)
  const totals: StageRow = {
    stage: 'Pending',
    count: rows.reduce((s, r) => s + r.count, 0),
    arrBasis: rows.reduce((s, r) => s + r.arrBasis, 0),
    oppArr: rows.reduce((s, r) => s + r.oppArr, 0),
    oppNetArr: rows.reduce((s, r) => s + r.oppNetArr, 0),
  }

  return (
    <InnerCard title="By Stage">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 130 }}>Stage</th>
            <th style={{ ...NUM_TH, width: 60 }}>#</th>
            <th style={{ ...NUM_TH, width: 130 }}>ARR Basis</th>
            <th style={{ ...NUM_TH, width: 120 }}>OPP ARR</th>
            <th style={{ ...NUM_TH, width: 120 }}>Net ARR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.stage}>
              <td style={TD}><span style={{ fontWeight: 500 }}>{row.stage}</span></td>
              <td style={NUM_TD}><Num n={row.count} /></td>
              <td style={NUM_TD}><Amt v={row.arrBasis} /></td>
              <td style={NUM_TD}><Amt v={row.oppArr} /></td>
              <td style={NUM_TD}><Amt v={row.oppNetArr} /></td>
            </tr>
          ))}
          <tr>
            <td style={TOTAL_LABEL_TD}>All Stages</td>
            <td style={TOTAL_TD}>{totals.count}</td>
            <td style={TOTAL_TD}><Amt v={totals.arrBasis} /></td>
            <td style={TOTAL_TD}><Amt v={totals.oppArr} /></td>
            <td style={TOTAL_TD}><Amt v={totals.oppNetArr} /></td>
          </tr>
        </tbody>
      </table>
    </InnerCard>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function RepBreakdownWidget({ opps }: { opps: SFRenewalOpp[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '1px solid var(--border)' : undefined,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>Pipeline Breakdown</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <RepCard opps={opps} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <StageCard opps={opps} />
          </div>
        </div>
      )}
    </div>
  )
}
