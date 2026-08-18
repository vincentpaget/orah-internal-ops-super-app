'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { TabKey, WarningKey } from '@/lib/sql-handoff/types'
import type { DashboardMetrics, MatrixRow } from '@/lib/sql-handoff/logic'
import { MATRIX_TAB_HEADS } from '@/lib/sql-handoff/logic'

interface Props {
  metrics: DashboardMetrics
  stageCounts: { key: TabKey; label: string; count: number }[]
  warningsSummary: { key: WarningKey; label: string; count: number }[]
  wTotal: number
  ownerMatrix: MatrixRow[]
  creatorMatrix: MatrixRow[]
  onStageClick: (key: TabKey) => void
}

const CARD: CSSProperties = { background: '#fff', border: '1px solid #EEEEEE', borderRadius: 10, overflow: 'hidden' }
const HEAD_BASE: CSSProperties = { width: '100%', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#FAFAFA', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Open Sans', sans-serif", display: 'grid' }
const HEAD3: CSSProperties = { ...HEAD_BASE, gridTemplateColumns: 'minmax(140px,1fr) repeat(4, 1fr)', gap: 24 }
const HEAD2: CSSProperties = { ...HEAD_BASE, gridTemplateColumns: 'minmax(0,1fr) 76px' }
const COL_HEAD: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E', textAlign: 'right' }
const CARET: CSSProperties = { fontSize: 9, color: '#9E9E9E', transition: 'transform 150ms', display: 'inline-block' }
const ROW3: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) repeat(4, 1fr)', gap: 24, padding: '7px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', alignItems: 'center' }
const ROW2: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 76px', gap: 8, padding: '7px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', alignItems: 'center' }
const CELL_LABEL: CSSProperties = { fontSize: 13, color: 'rgba(0,0,0,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const CELL_VAL: CSSProperties = { fontSize: 13, textAlign: 'right' }

const WARN_COLOR: Record<WarningKey, string> = { step: '#D32F2F', act: '#F57C00', meet: '#D32F2F', age: '#D32F2F' }
const STAGE_COLOR: Record<string, string> = { held: '#2E7D32', scheduled: '#F57C00', 'outcome-required': '#8255B1' }

function Collapsible({ title, children, defaultOpen = true, headStyle, right }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; headStyle: CSSProperties; right?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={CARD}>
      <button onClick={() => setOpen(o => !o)} style={{ ...headStyle, borderBottom: open ? '1px solid rgba(0,0,0,0.09)' : 'none' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...CARET, transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>{title}
        </span>
        {right}
      </button>
      {open && children}
    </div>
  )
}

export default function DashboardView({ metrics, stageCounts, warningsSummary, wTotal, ownerMatrix, creatorMatrix, onStageClick }: Props) {
  const [creatorOpen, setCreatorOpen] = useState(true)
  const [ownerOpen, setOwnerOpen] = useState(true)

  const metricRows: { label: string; key: keyof DashboardMetrics['l7']; color?: string }[] = [
    { label: 'SQLs Created', key: 'newSql' },
    { label: 'Created & Converted', key: 'cohort', color: '#2E7D32' },
    { label: 'SQL → SQO %', key: 'pct', color: '#0073E6' },
    { label: 'SQO # Created', key: 'conv', color: '#2E7D32' },
    { label: 'SQO $ Created', key: 'arr', color: '#2E7D32' },
    { label: 'Median days to SQO', key: 'speed', color: 'rgba(0,0,0,0.87)' },
    { label: 'Avg days to SQO', key: 'avg', color: 'rgba(0,0,0,0.87)' },
  ]

  const maxStage = Math.max(...stageCounts.map(s => s.count), 1)

  return (
    <div style={{ padding: '16px 24px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, alignItems: 'start' }}>
        <Collapsible
          headStyle={HEAD3}
          title="Key METRICS"
          right={<><span style={COL_HEAD}>L7D</span><span style={COL_HEAD}>L30D</span><span style={COL_HEAD}>MTD</span><span style={COL_HEAD}>QTD</span></>}
        >
          {metricRows.map((row, i) => (
            <div key={row.key} style={{ ...ROW3, borderBottom: i === metricRows.length - 1 ? 'none' : ROW3.borderBottom }}>
              <span style={CELL_LABEL}>{row.label}</span>
              <span style={{ ...CELL_VAL, color: row.color ?? '#262626' }}>{metrics.l7[row.key]}</span>
              <span style={{ ...CELL_VAL, color: row.color ?? '#262626' }}>{metrics.l30[row.key]}</span>
              <span style={{ ...CELL_VAL, color: row.color ?? '#262626' }}>{metrics.mtd[row.key]}</span>
              <span style={{ ...CELL_VAL, color: row.color ?? '#262626' }}>{metrics.qtd[row.key]}</span>
            </div>
          ))}
        </Collapsible>

        <Collapsible headStyle={HEAD2} title="Open SQLs By Stage" right={<span style={COL_HEAD}>Count</span>}>
          <div style={{ padding: '4px 0' }}>
            {stageCounts.map(s => (
              <button
                key={s.key}
                onClick={() => onStageClick(s.key)}
                style={{ display: 'grid', gridTemplateColumns: '148px minmax(50px,1fr) 26px', gap: 8, alignItems: 'center', width: '100%', padding: '5px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'Open Sans', sans-serif" }}
              >
                <span style={CELL_LABEL}>{s.label}</span>
                <span style={{ display: 'block', background: '#F5F5F5', borderRadius: 100, height: 10 }}>
                  <span style={{
                    display: 'block', height: 10, borderRadius: 100, background: STAGE_COLOR[s.key] ?? '#0073E6',
                    opacity: s.count ? 1 : 0.15, width: `${Math.max((s.count / maxStage) * 100, s.count ? 4 : 2)}%`,
                  }} />
                </span>
                <span style={{ fontSize: 12, color: s.count ? 'rgba(0,0,0,0.87)' : 'rgba(0,0,0,0.38)', textAlign: 'right' }}>{s.count}</span>
              </button>
            ))}
          </div>
        </Collapsible>

        <Collapsible headStyle={HEAD2} title={`Warnings · ${wTotal} Flagged SQLs`} right={<span style={COL_HEAD}>Count</span>}>
          {warningsSummary.map((w, i) => (
            <div key={w.key} style={{ ...ROW2, borderBottom: i === warningsSummary.length - 1 ? 'none' : ROW2.borderBottom }}>
              <span style={CELL_LABEL}>{w.label}</span>
              <span style={{ fontSize: 13, textAlign: 'right', color: WARN_COLOR[w.key] }}>{w.count}</span>
            </div>
          ))}
        </Collapsible>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 12, alignItems: 'start' }}>
        <MatrixCard title="Open SQLs By Creator" rows={creatorMatrix} open={creatorOpen} onToggle={() => setCreatorOpen(o => !o)} />
        <MatrixCard title="Open SQLs By Owner" rows={ownerMatrix} open={ownerOpen} onToggle={() => setOwnerOpen(o => !o)} />
      </div>
    </div>
  )
}

function MatrixCard({ title, rows, open, onToggle }: { title: string; rows: MatrixRow[]; open: boolean; onToggle: () => void }) {
  const mgrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) repeat(4, minmax(110px,1fr)) 70px', gap: 12, alignItems: 'center', padding: '7px 12px' }
  const mhead: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#9E9E9E', textAlign: 'right', whiteSpace: 'normal', lineHeight: '13px' }
  return (
    <div style={{ ...CARD, minWidth: 0 }}>
      <button onClick={onToggle} style={{ width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Open Sans', sans-serif", background: '#FAFAFA', display: 'block', padding: 0, borderBottom: open ? '1px solid rgba(0,0,0,0.09)' : 'none' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px 6px' }}>
          <span style={{ ...CARET, transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>{title}
        </span>
        <span style={{ ...mgrid, paddingTop: 0, paddingBottom: 8 }}>
          <span />
          {MATRIX_TAB_HEADS.map(h => <span key={h.key} title={h.tip} style={mhead}>{h.label}</span>)}
          <span style={mhead}>TOTAL</span>
        </span>
      </button>
      {open && rows.map((row, i) => (
        <div key={row.name} style={{ ...mgrid, borderBottom: i === rows.length - 1 ? undefined : '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.66)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
          {row.cells.map((v, ci) => (
            <span key={ci} style={{ fontSize: 13, textAlign: 'right', color: v ? 'rgba(0,0,0,0.87)' : 'rgba(0,0,0,0.24)' }}>{v}</span>
          ))}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#262626', textAlign: 'right' }}>{row.total}</span>
        </div>
      ))}
    </div>
  )
}
