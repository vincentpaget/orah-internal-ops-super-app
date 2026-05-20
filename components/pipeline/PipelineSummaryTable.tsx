import type { Opportunity, StageRow } from '@/lib/types'
import { STAGE_ORDER, STAGE_DISPLAY, STAGE_FUNNEL } from '@/lib/types'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'

interface Props {
  opps: Opportunity[]
}

const CATEGORY_COLORS: Record<string, string> = {
  SQO: 'var(--blue-500)',
  SAO: 'var(--orange-500)',
  SQL: 'var(--purple-500)',
  Won: 'var(--green-600)',
  Lost: 'var(--fg-3)',
}

function FlaggedCount({ n, total }: { n: number; total: number }) {
  if (total === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  if (n === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--green-700)', fontWeight: 600 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        0
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, height: 20, padding: '0 7px', borderRadius: 999,
      background: 'var(--red-50)', color: 'var(--red-700)',
      fontWeight: 700, ...FS.badge,
    }}>
      {n}
    </span>
  )
}

function HealthBar({ pct, total }: { pct: number; total: number }) {
  if (total === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>
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

const TH: React.CSSProperties = {
  padding: '10px 16px',
  color: 'var(--fg-3)', fontWeight: 600, ...FS.badge,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  background: 'transparent',
}

const TOTAL_BORDER = '2px solid var(--border-strong)'

export default function PipelineSummaryTable({ opps }: Props) {
  const isClosed = (stage: string) => stage === 'Closed Won' || stage === 'Closed Lost'

  const isFlagged = (o: (typeof opps)[0]) =>
    o.flags.length > 0 || (o.StageName === 'Qualifying' && o.sqlBucket !== 'Demo Scheduled')

  const rows: (StageRow & { flaggedCount: number; healthPct: number })[] = STAGE_ORDER.map(stage => {
    const stageOpps = opps.filter(o => o.StageName === stage)
    const flaggedCount = stageOpps.filter(isFlagged).length
    const healthPct = stageOpps.length === 0
      ? 100
      : Math.round(((stageOpps.length - flaggedCount) / stageOpps.length) * 100)
    return {
      stage,
      count: stageOpps.length,
      totalARR: stageOpps.reduce((sum, o) => sum + (o.Net_ARR_NZD__c ?? 0), 0),
      flaggedCount,
      healthPct,
    }
  })

  const openRows = rows.filter(r => !isClosed(r.stage))

  const openTotals = {
    count: openRows.reduce((s, r) => s + r.count, 0),
    totalARR: openRows.reduce((s, r) => s + r.totalARR, 0),
    flaggedCount: openRows.reduce((s, r) => s + r.flaggedCount, 0),
  }
  const openHealthPct = openTotals.count === 0
    ? 100
    : Math.round(((openTotals.count - openTotals.flaggedCount) / openTotals.count) * 100)

  const totals = {
    count: rows.reduce((s, r) => s + r.count, 0),
    totalARR: rows.reduce((s, r) => s + r.totalARR, 0),
    flaggedCount: rows.reduce((s, r) => s + r.flaggedCount, 0),
  }
  const totalHealthPct = totals.count === 0
    ? 100
    : Math.round(((totals.count - totals.flaggedCount) / totals.count) * 100)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, ...FS.base }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: 'left', width: 110 }}>Category</th>
            <th style={{ ...TH, ...COL.stage, textAlign: 'left' }}>Stage</th>
            <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>Pipeline ARR</th>
            <th style={{ ...TH, ...COL.count, textAlign: 'right' }}>Opps</th>
            <th style={{ ...TH, ...COL.count, textAlign: 'right' }}>Flagged</th>
            <th style={{ ...TH, ...COL.healthScore, textAlign: 'right' }}>Hygiene Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const empty = row.count === 0
            const funnel = STAGE_FUNNEL[row.stage]
            const dotColor = CATEGORY_COLORS[funnel] ?? 'var(--fg-3)'
            const textColor = 'var(--fg)'
            const BD = '1px solid var(--border-subtle)'
            return (
              <tr key={row.stage}>
                <td style={{ padding: '10px 16px', verticalAlign: 'middle', borderBottom: BD }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: 'var(--fg-1)', ...FS.body }}>
                      {funnel}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', color: textColor, borderBottom: BD, verticalAlign: 'middle' }}>
                  {STAGE_DISPLAY[row.stage]}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: textColor, borderBottom: BD, verticalAlign: 'middle' }}>
                  {empty ? <span style={{ color: 'var(--fg-3)' }}>—</span> : nzd(row.totalARR)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)', borderBottom: BD, verticalAlign: 'middle' }}>
                  {row.count}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: BD, verticalAlign: 'middle' }}>
                  <FlaggedCount n={row.flaggedCount} total={row.count} />
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: BD, verticalAlign: 'middle' }}>
                  <HealthBar pct={row.healthPct} total={row.count} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--fg-1)', borderTop: TOTAL_BORDER }}>
              Total (Open)
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)', borderTop: TOTAL_BORDER }}>
              {nzd(openTotals.totalARR)}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)', borderTop: TOTAL_BORDER }}>
              {openTotals.count}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, borderTop: TOTAL_BORDER }}>
              <FlaggedCount n={openTotals.flaggedCount} total={openTotals.count} />
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, borderTop: TOTAL_BORDER }}>
              <HealthBar pct={openHealthPct} total={openTotals.count} />
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--fg-1)', borderTop: '1px solid var(--border)' }}>
              Total
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)', borderTop: '1px solid var(--border)' }}>
              {nzd(totals.totalARR)}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--fg-1)', borderTop: '1px solid var(--border)' }}>
              {totals.count}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
              <FlaggedCount n={totals.flaggedCount} total={totals.count} />
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
              <HealthBar pct={totalHealthPct} total={totals.count} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
