'use client'

import { useState } from 'react'
import type { Opportunity } from '@/lib/types'
import { SQO_STAGES } from '@/lib/types'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import SalesforceLink from '@/components/ui/SalesforceLink'
import FlagBadge from '@/components/ui/FlagBadge'
import StageTag from '@/components/ui/StageTag'
import DatePill from '@/components/ui/DatePill'

interface Props {
  opps: Opportunity[]
}

const TH: React.CSSProperties = {
  padding: '10px 16px',
  color: 'var(--fg-3)',
  fontWeight: 600,
  ...FS.badge,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'transparent',
  textAlign: 'left',
  verticalAlign: 'bottom',
}

const TD: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border-subtle)',
}

export default function TopDealsTable({ opps }: Props) {
  const [open, setOpen] = useState(false)
  const [stageFilters, setStageFilters] = useState<Set<string>>(new Set())
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

  const sqoOpps = opps.filter(o => (SQO_STAGES as readonly string[]).includes(o.StageName))
  const sorted = [...sqoOpps].sort((a, b) => (b.Net_ARR_NZD__c ?? 0) - (a.Net_ARR_NZD__c ?? 0))

  const filtered = sorted.filter(o => {
    if (stageFilters.size > 0 && !stageFilters.has(o.StageName)) return false
    if (showFlaggedOnly && o.flags.length === 0) return false
    return true
  })

  const totalARR = filtered.reduce((s, o) => s + (o.Net_ARR_NZD__c ?? 0), 0)
  const flaggedCount = filtered.filter(o => o.flags.length > 0).length
  const healthPct = filtered.length > 0
    ? Math.round(((filtered.length - flaggedCount) / filtered.length) * 100)
    : 100

  const healthColor = healthPct >= 80 ? 'var(--green-700)' : healthPct >= 60 ? 'var(--orange-700)' : 'var(--red-700)'
  const hasFilter = stageFilters.size > 0 || showFlaggedOnly

  function toggleStage(stage: string) {
    setStageFilters(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 24,
      overflow: 'hidden',
    }}>
      {/* Header / toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--bg)',
          borderBottom: open ? '1px solid var(--border)' : undefined,
        }}
      >
        <svg
          width="13" height="13" viewBox="0 0 14 14" fill="none"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
            color: 'var(--fg-3)',
          }}
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h2 style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)', margin: 0, flexShrink: 0 }}>
          Top deals
        </h2>
        <span style={{ ...FS.base, color: 'var(--fg-3)', fontWeight: 400 }}>≥ $20k NZD · SQO only</span>

        {/* Stats strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
          marginLeft: 'auto',
          flexShrink: 0,
        }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: 'Total ARR', value: nzd(totalARR) },
            { label: 'Opps', value: sorted.length === filtered.length ? String(sorted.length) : `${filtered.length} / ${sorted.length}` },
            { label: 'Flagged', value: String(flaggedCount), color: flaggedCount > 0 ? 'var(--red-700)' : 'var(--green-700)' },
            { label: 'Hygiene Score', value: `${healthPct}%`, color: healthColor },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
            }}>
              <span style={{ ...FS.label, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <span style={{ ...FS.body, fontWeight: 700, color: color ?? 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px 20px 20px' }}>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ ...FS.label, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Filter</span>
            {SQO_STAGES.map(stage => (
              <button
                key={stage}
                onClick={() => toggleStage(stage)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: stageFilters.has(stage) ? 'var(--navy-900)' : 'var(--border)',
                  background: stageFilters.has(stage) ? 'var(--navy-900)' : 'transparent',
                  color: stageFilters.has(stage) ? '#fff' : 'var(--fg-2)',
                  ...FS.badge,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {stage}
              </button>
            ))}
            <button
              onClick={() => setShowFlaggedOnly(x => !x)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: showFlaggedOnly ? 'var(--red-700)' : 'var(--border)',
                background: showFlaggedOnly ? 'var(--red-50)' : 'transparent',
                color: showFlaggedOnly ? 'var(--red-700)' : 'var(--fg-2)',
                ...FS.badge,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Flagged only
            </button>
            {hasFilter && (
              <button
                onClick={() => { setStageFilters(new Set()); setShowFlaggedOnly(false) }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--fg-3)',
                  ...FS.badge,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <p style={{ ...FS.base, color: 'var(--fg-3)', fontStyle: 'italic', margin: 0 }}>No SQO deals ≥ $20k NZD.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, ...COL.rank, textAlign: 'right', paddingRight: 8 }}>#</th>
                    <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
                    <th style={{ ...TH, ...COL.owner }}>Owner</th>
                    <th style={{ ...TH, ...COL.stage }}>Stage</th>
                    <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
                    <th style={{ ...TH, ...COL.date }}>Close</th>
                    <th style={{ ...TH, ...COL.meddicc, textAlign: 'right' }}>MEDDICC</th>
                    <th style={{ ...TH, ...COL.flags }}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((opp) => {
                    const rank = sorted.indexOf(opp) + 1
                    return (
                      <tr key={opp.Id} style={{ transition: 'background 120ms' }}>
                        <td style={{ ...TD, padding: '12px 8px 12px 16px', textAlign: 'right', color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums', ...FS.body }}>
                          {rank}
                        </td>
                        <td style={{ ...TD, ...COL.opportunity }}>
                          <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                        </td>
                        <td style={{ ...TD, color: 'var(--fg-2)' }}>
                          {opp['Owner.Name']}
                        </td>
                        <td style={{ ...TD }}>
                          <StageTag stage={opp.StageName} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--fg-1)' }}>
                          {nzd(opp.Net_ARR_NZD__c)}
                        </td>
                        <td style={{ ...TD }}>
                          <DatePill date={opp.CloseDate} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>
                          {opp.MEDDICC_Score__c != null ? `${opp.MEDDICC_Score__c}%` : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                        </td>
                        <td style={{ ...TD, ...COL.flags }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {opp.flags.length > 0
                              ? opp.flags.map(f => <FlagBadge key={f} flag={f} />)
                              : <span style={{ color: 'var(--green-700)', fontWeight: 600, ...FS.body }}>✓ Clean</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p style={{ padding: '20px 16px', color: 'var(--fg-3)', ...FS.base, fontStyle: 'italic', margin: 0 }}>
                  No deals match the current filters.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
