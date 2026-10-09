'use client'

import { Fragment, useState } from 'react'
import type { SFCommissionOpportunity } from '@/lib/commissions/types'
import { buildPayRunHistory, paidAmountNZD } from '@/lib/commissions/payable'
import { toNZD } from '@/lib/commissions/currency'
import { nzd, shortDate } from '@/lib/formatters'
import SalesforceLink from '@/components/ui/SalesforceLink'

interface Props {
  deals: SFCommissionOpportunity[]
}

const TH: React.CSSProperties = {
  padding: '6px 10px',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const NUM: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const PILL: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  borderRadius: 6,
  background: '#FAFAFA',
  fontSize: 12,
  color: 'rgba(0,0,0,0.54)',
  whiteSpace: 'nowrap',
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={PILL}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: '#262626' }}>{value}</span>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 150ms', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}>
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/** Month key (YYYY-MM) twelve months before the current month — runs on or after it count toward "last 12 months". */
function twelveMonthsAgoKey(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PayRunHistoryView({ deals }: Props) {
  const [openRuns, setOpenRuns] = useState<Set<string>>(new Set())
  const [openReps, setOpenReps] = useState<Set<string>>(new Set())

  if (deals.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>
        No paid commissions found.
      </p>
    )
  }

  const runs = buildPayRunHistory(deals)
  const datedRuns = runs.filter(r => r.monthKey !== 'unscheduled')
  const lastRun = datedRuns[0]
  const cutoff = twelveMonthsAgoKey()
  const last12Total = datedRuns.filter(r => r.monthKey >= cutoff).reduce((s, r) => s + r.totalPaidNZD, 0)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 16px' }}>
        Past pay runs — deals marked SF Commission Paid, grouped by the month of SF Commission Paid Date. Click a run to see each rep&apos;s total, then a rep to see their deals.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {lastRun && <StatPill label="Last pay run" value={`${lastRun.monthLabel} · ${nzd(lastRun.totalPaidNZD)}`} />}
        <StatPill label="Paid, last 12 months" value={nzd(last12Total)} />
        <StatPill label="Pay runs" value={String(datedRuns.length)} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={TH}>Pay run</th>
              <th style={TH}>Record Type</th>
              <th style={TH}>Close Date</th>
              <th style={{ ...TH, textAlign: 'right' }}>Amount (NZD)</th>
              <th style={{ ...TH, textAlign: 'right' }}>Reps</th>
              <th style={{ ...TH, textAlign: 'right' }}>Deals</th>
              <th style={{ ...TH, textAlign: 'right' }}>Total Paid</th>
              <th style={TH}>Paid Date</th>
              <th style={TH}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => {
              const runOpen = openRuns.has(run.monthKey)
              return (
                <Fragment key={run.monthKey}>
                  <tr
                    onClick={() => setOpenRuns(prev => toggle(prev, run.monthKey))}
                    style={{ cursor: 'pointer', background: runOpen ? 'var(--blue-50)' : 'var(--bg)' }}
                  >
                    <td style={{ ...TD, fontWeight: 600, color: 'var(--fg-1)', fontSize: 13 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Chevron open={runOpen} />
                        {run.monthLabel}
                      </span>
                    </td>
                    <td style={TD} />
                    <td style={TD} />
                    <td style={TD} />
                    <td style={{ ...TD, ...NUM }}>{run.repCount}</td>
                    <td style={{ ...TD, ...NUM }}>{run.dealCount}</td>
                    <td style={{ ...TD, ...NUM, fontWeight: 700, color: 'var(--fg-1)', fontSize: 13 }}>{nzd(run.totalPaidNZD)}</td>
                    <td style={TD} />
                    <td style={TD} />
                  </tr>

                  {runOpen && run.reps.map(rep => {
                    const repKey = `${run.monthKey}::${rep.ownerId}`
                    const repOpen = openReps.has(repKey)
                    return (
                      <Fragment key={repKey}>
                        <tr onClick={() => setOpenReps(prev => toggle(prev, repKey))} style={{ cursor: 'pointer' }}>
                          <td style={{ ...TD, paddingLeft: 30, fontWeight: 600, color: 'var(--fg-1)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Chevron open={repOpen} />
                              {rep.ownerName}
                            </span>
                          </td>
                          <td style={TD} />
                          <td style={TD} />
                          <td style={TD} />
                          <td style={TD} />
                          <td style={{ ...TD, ...NUM }}>{rep.dealCount}</td>
                          <td style={{ ...TD, ...NUM, fontWeight: 600, color: 'var(--fg-1)' }}>{nzd(rep.totalPaidNZD)}</td>
                          <td style={TD} />
                          <td style={TD} />
                        </tr>

                        {repOpen && rep.deals.map(deal => (
                          <tr key={deal.Id} style={{ background: 'var(--bg-subtle)' }}>
                            <td style={{ ...TD, paddingLeft: 66, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <SalesforceLink label={deal.Name} opportunityId={deal.Id} />
                            </td>
                            <td style={{ ...TD, color: 'var(--fg-2)' }}>{deal['RecordType.Name'] ?? '—'}</td>
                            <td style={{ ...TD, color: 'var(--fg-2)' }}>{shortDate(deal.CloseDate)}</td>
                            <td style={{ ...TD, ...NUM, color: 'var(--fg-2)' }}>
                              {nzd(toNZD(deal.Net_ARR_Override__c, deal.Static_Currency_Conversion_Rate__c))}
                            </td>
                            <td style={TD} />
                            <td style={TD} />
                            <td style={{ ...TD, ...NUM, color: 'var(--fg-1)' }}>{nzd(paidAmountNZD(deal))}</td>
                            <td style={{ ...TD, color: 'var(--fg-2)' }}>{shortDate(deal.Commission_Paid_Date__c)}</td>
                            <td style={{ ...TD, color: 'var(--fg-2)', whiteSpace: 'normal', minWidth: 240 }}>{deal.Commission_Notes__c ?? ''}</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
