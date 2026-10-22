'use client'

import { useState } from 'react'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'
import SalesforceLink from '@/components/ui/SalesforceLink'
import DatePill from '@/components/ui/DatePill'
import { shortDate } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import {
  TH, TD, STICKY_TH, STICKY_TD, AMT_TH, AMT_TD,
  STAGE_ORDER, CLOSED_RENEWAL_STAGES, CLOSED_EXPANSION_STAGES,
  StageCell, TypeCell, PipelineBadge, LongTextCell, CurrencyPairCell,
} from './AllDealsTable'

interface Props {
  renewals: SFRenewalOpp[]
  expansions: SFExpansionOpp[]
}

type SortCol = 'stage' | 'net_arr' | 'age' | 'close_date' | 'last_meeting' | 'next_meeting'
type SortDir = 'asc' | 'desc'

type Row =
  | { kind: 'renewal'; opp: SFRenewalOpp }
  | { kind: 'expansion'; opp: SFExpansionOpp }

function d(s: string | null | undefined): number { return s ? new Date(s).getTime() : 0 }

function ageInDays(createdDate: string): number {
  return Math.floor((Date.now() - new Date(createdDate).getTime()) / 86_400_000)
}

function getRowSortVal(row: Row, col: SortCol): number {
  const opp = row.opp
  switch (col) {
    case 'stage': { const i = STAGE_ORDER.indexOf(opp.StageName); return i === -1 ? STAGE_ORDER.length : i }
    case 'net_arr':      return opp.Net_ARR_NZD__c ?? opp.Net_ARR__c ?? 0
    case 'age':          return ageInDays(opp.CreatedDate)
    case 'close_date':   return d(opp.CloseDate)
    case 'last_meeting': return d(opp.Last_Meeting_Date__c)
    case 'next_meeting': return d(opp.Next_Meeting_Date__c)
  }
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color: active ? 'var(--fg-1)' : 'var(--fg-3)', flexShrink: 0 }}>
      {active ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )
}

function DateText({ date }: { date: string | null | undefined }) {
  if (!date) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return <span style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{shortDate(date)}</span>
}

export default function SimplifiedTable({ renewals, expansions }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(col: SortCol) {
    setSortCol(prev => {
      if (prev !== col) { setSortDir('desc'); return col }
      if (sortDir === 'desc') { setSortDir('asc'); return col }
      setSortDir('desc'); return null
    })
  }

  const baseRows: Row[] = [
    ...renewals.map(opp => ({ kind: 'renewal' as const, opp })),
    ...expansions.map(opp => ({ kind: 'expansion' as const, opp })),
  ].sort((a, b) => a.opp.CloseDate.localeCompare(b.opp.CloseDate))

  const rows = sortCol === null ? baseRows : [...baseRows].sort((a, b) => {
    const diff = getRowSortVal(a, sortCol) - getRowSortVal(b, sortCol)
    return sortDir === 'desc' ? -diff : diff
  })

  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
        No deals match the current filters.
      </div>
    )
  }

  const sortProps = { sortCol, sortDir }
  const sortTh = (col: SortCol, label: string, width: number, align: 'left' | 'right' = 'left') => (
    <th onClick={() => toggleSort(col)} style={{ ...(align === 'right' ? AMT_TH : TH), width, cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}<SortIcon col={col} {...sortProps} />
      </span>
    </th>
  )

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <table style={{ width: '100%', minWidth: 2100, borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...STICKY_TH, width: 280 }}>Name</th>
            <th style={{ ...TH, width: 130 }}>Owner</th>
            {sortTh('stage', 'Stage', 140)}
            {sortTh('net_arr', 'Amount (Net ARR)', 140, 'right')}
            <th style={{ ...TH, width: 100 }}>Record Type</th>
            <th style={{ ...TH, width: 140 }}>Type</th>
            {sortTh('age', 'Age', 70)}
            {sortTh('close_date', 'Close Date', 110)}
            {sortTh('last_meeting', 'Last Meeting', 110)}
            {sortTh('next_meeting', 'Next Meeting', 110)}
            <th style={{ ...TH, width: 360 }}>Next Step</th>
            <th style={{ ...TH, width: 360 }}>Expansion Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const opp = row.opp
            const isClosed = row.kind === 'renewal'
              ? CLOSED_RENEWAL_STAGES.has(opp.StageName)
              : CLOSED_EXPANSION_STAGES.has(opp.StageName)
            return (
              <tr key={`${row.kind}_${opp.Id}`}>
                <td style={{ ...STICKY_TD, width: 280 }}>
                  <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                </td>
                <td style={{ ...TD, width: 130, color: 'var(--fg-2)' }}>{opp['Owner.Name']}</td>
                <td style={{ ...TD, width: 140 }}><StageCell stage={opp.StageName} /></td>
                <td style={{ ...AMT_TD, width: 140 }}>
                  <CurrencyPairCell value={opp.Net_ARR__c} code={opp.CurrencyIsoCode ?? 'AUD'} nzdValue={opp.Net_ARR_NZD__c} signed />
                </td>
                <td style={{ ...TD, width: 100 }}><PipelineBadge kind={row.kind} /></td>
                <td style={{ ...TD, width: 140 }}><TypeCell value={opp.Type} /></td>
                <td style={{ ...TD, width: 70, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{`${ageInDays(opp.CreatedDate)}d`}</td>
                <td style={{ ...TD, width: 110 }}><DatePill date={opp.CloseDate} noWarning={isClosed} /></td>
                <td style={{ ...TD, width: 110 }}><DateText date={opp.Last_Meeting_Date__c} /></td>
                <td style={{ ...TD, width: 110 }}><DateText date={opp.Next_Meeting_Date__c} /></td>
                <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.NextStep} /></td>
                <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.Expansion_Notes__c} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
