'use client'

import { useState } from 'react'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'
import { getRenewalFlags, getExpansionFlags } from '@/lib/csHygiene'
import FlagsCell from './FlagsCell'
import SalesforceLink from '@/components/ui/SalesforceLink'
import DatePill from '@/components/ui/DatePill'
import { fmtCurrency } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'

interface Props {
  renewals: SFRenewalOpp[]
  expansions: SFExpansionOpp[]
}

type SortCol = 'flags' | 'stage' | 'arr_basis' | 'auto_renewal' | 'auto_renewal_net_arr' | 'booked_arr' | 'net_arr' | 'close_date'
type SortDir = 'asc' | 'desc'

const STAGE_ORDER = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost', 'Closed Lost - Churned', 'Closed - Recycle', 'Closed - Disqualified']

const CLOSED_RENEWAL_STAGES = new Set(['Closed Won', 'Closed Lost - Churned'])
const CLOSED_EXPANSION_STAGES = new Set(['Closed Won', 'Closed Lost'])

const TH: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  color: 'var(--fg-3)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'var(--bg-subtle)',
}

const TD: React.CSSProperties = {
  padding: '11px 14px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
  ...FS.body,
  background: 'var(--bg)',
}

const STICKY_TH: React.CSSProperties = {
  ...TH,
  position: 'sticky',
  left: 0,
  zIndex: 2,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}

const STICKY_TD: React.CSSProperties = {
  ...TD,
  position: 'sticky',
  left: 0,
  zIndex: 1,
  boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
}

const AMT_TH: React.CSSProperties = { ...TH, textAlign: 'right' }
const AMT_TD: React.CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

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

function StageCell({ stage }: { stage: string }) {
  const { bg, color } = STAGE_COLORS[stage] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: bg, color, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

function PipelineBadge({ kind }: { kind: 'renewal' | 'expansion' }) {
  const isRenewal = kind === 'renewal'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: isRenewal ? 'var(--blue-50)' : 'var(--green-50)', color: isRenewal ? 'var(--navy-900)' : 'var(--green-700)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {isRenewal ? 'Renewal' : 'Expansion'}
    </span>
  )
}

function LongTextCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return (
    <span style={{ color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {value}
    </span>
  )
}

function CurrencyPairCell({ value, code, nzdValue, signed = false }: {
  value: number | null | undefined
  code: string
  nzdValue?: number | null
  signed?: boolean
}) {
  if (value == null) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  if (signed && value === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const color = signed ? (value > 0 ? 'var(--green-500)' : 'var(--red-400)') : 'var(--fg-1)'
  const emoji = signed ? (value > 0 ? '▲ ' : '▼ ') : ''
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>{emoji}{fmtCurrency(value, code)}</span>
      {nzdValue != null && (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: signed ? color : 'var(--fg-3)' }}>
          ({fmtCurrency(nzdValue, 'NZD')})
        </span>
      )}
    </span>
  )
}

function BoolCell({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      background: value ? 'var(--red-50)' : 'var(--bg-subtle)',
      color: value ? 'var(--red-700)' : 'var(--fg-3)',
    }}>
      {value ? 'Yes' : 'No'}
    </span>
  )
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color: active ? 'var(--fg-1)' : 'var(--fg-3)', flexShrink: 0 }}>
      {active ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )
}

type Row =
  | { kind: 'renewal'; opp: SFRenewalOpp; sortKey: string }
  | { kind: 'expansion'; opp: SFExpansionOpp; sortKey: string }

function d(s: string | null | undefined): number { return s ? new Date(s).getTime() : 0 }

function getRowSortVal(row: Row, col: SortCol): number {
  const opp = row.opp
  switch (col) {
    case 'flags':         return row.kind === 'renewal' ? getRenewalFlags(opp as SFRenewalOpp).length : getExpansionFlags(opp as SFExpansionOpp).length
    case 'stage': { const i = STAGE_ORDER.indexOf(opp.StageName); return i === -1 ? STAGE_ORDER.length : i }
    case 'arr_basis':            return opp.ARR_Basis_NZD__c ?? opp.ARR_Basis__c ?? 0
    case 'auto_renewal':         return row.kind === 'renewal' ? ((opp as SFRenewalOpp).Auto_Renewal_Amount_NZD__c ?? (opp as SFRenewalOpp).Auto_Renewal_Amount__c ?? 0) : 0
    case 'auto_renewal_net_arr': return row.kind === 'renewal' ? ((opp as SFRenewalOpp).Auto_Renewal_Net_ARR_NZD__c ?? (opp as SFRenewalOpp).Auto_Renewal_Net_ARR__c ?? 0) : 0
    case 'booked_arr':           return opp.Booked_ARR_NZD__c ?? opp.Booked_ARR__c ?? 0
    case 'net_arr':              return opp.Net_ARR_NZD__c ?? opp.Net_ARR__c ?? 0
    case 'close_date':           return d(opp.CloseDate)
  }
}

export default function AllDealsTable({ renewals, expansions }: Props) {
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
    ...renewals.map(opp => ({ kind: 'renewal' as const, opp, sortKey: opp.CloseDate })),
    ...expansions.map(opp => ({ kind: 'expansion' as const, opp, sortKey: opp.CloseDate })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const rows = sortCol === null ? baseRows : [...baseRows].sort((a, b) => {
    const diff = getRowSortVal(a, sortCol) - getRowSortVal(b, sortCol)
    return sortDir === 'desc' ? -diff : diff
  })

  const sortProps = { sortCol, sortDir }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
        No deals match the current filters.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <table style={{ width: '100%', minWidth: 3370, borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...STICKY_TH, width: 280 }}>Opportunity</th>
            <th onClick={() => toggleSort('flags')} style={{ ...TH, width: 80, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Flags<SortIcon col="flags" {...sortProps} /></span>
            </th>
            <th style={{ ...TH, width: 100 }}>Pipeline</th>
            <th style={{ ...TH, width: 130 }}>Owner</th>
            <th onClick={() => toggleSort('close_date')} style={{ ...TH, width: 100, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Close Date<SortIcon col="close_date" {...sortProps} /></span>
            </th>
            <th onClick={() => toggleSort('stage')} style={{ ...TH, width: 140, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>Stage<SortIcon col="stage" {...sortProps} /></span>
            </th>
            <th style={{ ...TH, width: 140 }}>Type</th>
            <th style={{ ...TH, width: 140 }}>Category</th>
            <th style={{ ...TH, width: 110, textAlign: 'center' }}>Do Not Auto Renew</th>
            <th style={{ ...TH, width: 300 }}>Pricebook</th>
            <th onClick={() => toggleSort('arr_basis')} style={{ ...AMT_TH, width: 120, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>ARR Basis<SortIcon col="arr_basis" {...sortProps} /></span>
            </th>
            <th onClick={() => toggleSort('auto_renewal')} style={{ ...AMT_TH, width: 150, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>Auto Renewal Amount<SortIcon col="auto_renewal" {...sortProps} /></span>
            </th>
            <th onClick={() => toggleSort('auto_renewal_net_arr')} style={{ ...AMT_TH, width: 130, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>Auto Renewal Net ARR<SortIcon col="auto_renewal_net_arr" {...sortProps} /></span>
            </th>
            <th onClick={() => toggleSort('booked_arr')} style={{ ...AMT_TH, width: 120, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>Opp ARR<SortIcon col="booked_arr" {...sortProps} /></span>
            </th>
            <th onClick={() => toggleSort('net_arr')} style={{ ...AMT_TH, width: 120, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>Opp Net ARR<SortIcon col="net_arr" {...sortProps} /></span>
            </th>
            <th style={{ ...TH, width: 360 }}>Next Step</th>
            <th style={{ ...TH, width: 360 }}>Renewal Risk Notes</th>
            <th style={{ ...TH, width: 360 }}>Expansion Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (row.kind === 'renewal') {
              const opp = row.opp
              const isClosed = CLOSED_RENEWAL_STAGES.has(opp.StageName)
              const code = opp.CurrencyIsoCode ?? 'AUD'
              return (
                <tr key={`r_${opp.Id}`}>
                  <td style={{ ...STICKY_TD, width: 280 }}>
                    <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                  </td>
                  <td style={{ ...TD, width: 80 }}><FlagsCell flags={getRenewalFlags(opp)} /></td>
                  <td style={{ ...TD, width: 100 }}><PipelineBadge kind="renewal" /></td>
                  <td style={{ ...TD, width: 130, color: 'var(--fg-2)' }}>{opp['Owner.Name']}</td>
                  <td style={{ ...TD, width: 100 }}><DatePill date={opp.CloseDate} noWarning={isClosed} /></td>
                  <td style={{ ...TD, width: 140 }}><StageCell stage={opp.StageName} /></td>
                  <td style={{ ...TD, width: 140 }}><TypeCell value={opp.Type} /></td>
                  <td style={{ ...TD, width: 140, color: 'var(--fg-3)' }}>—</td>
                  <td style={{ ...TD, width: 110, textAlign: 'center' }}><BoolCell value={opp.Do_Not_Auto_Renew__c} /></td>
                  <td style={{ ...TD, width: 300, color: 'var(--fg-2)', fontSize: 13 }}>{opp['Pricebook2.Name'] ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                  <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.ARR_Basis__c} code={code} nzdValue={opp.ARR_Basis_NZD__c} /></td>
                  <td style={{ ...AMT_TD, width: 150 }}><CurrencyPairCell value={opp.Auto_Renewal_Amount__c} code={code} nzdValue={opp.Auto_Renewal_Amount_NZD__c} /></td>
                  <td style={{ ...AMT_TD, width: 130 }}><CurrencyPairCell value={opp.Auto_Renewal_Net_ARR__c} code={code} nzdValue={opp.Auto_Renewal_Net_ARR_NZD__c} signed /></td>
                  <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.Booked_ARR__c} code={code} nzdValue={opp.Booked_ARR_NZD__c} /></td>
                  <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.Net_ARR__c} code={code} nzdValue={opp.Net_ARR_NZD__c} signed /></td>
                  <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.NextStep} /></td>
                  <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.Renewal_Risk_Notes__c} /></td>
                  <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.Expansion_Notes__c} /></td>
                </tr>
              )
            }

            const opp = row.opp
            const isClosed = CLOSED_EXPANSION_STAGES.has(opp.StageName)
            return (
              <tr key={`e_${opp.Id}`}>
                <td style={{ ...STICKY_TD, width: 280 }}>
                  <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                </td>
                <td style={{ ...TD, width: 80 }}><FlagsCell flags={getExpansionFlags(opp)} /></td>
                <td style={{ ...TD, width: 100 }}><PipelineBadge kind="expansion" /></td>
                <td style={{ ...TD, width: 130, color: 'var(--fg-2)' }}>{opp['Owner.Name']}</td>
                <td style={{ ...TD, width: 100 }}><DatePill date={opp.CloseDate} noWarning={isClosed} /></td>
                <td style={{ ...TD, width: 140 }}><StageCell stage={opp.StageName} /></td>
                <td style={{ ...TD, width: 140 }}><TypeCell value={opp.Type} /></td>
                <td style={{ ...TD, width: 140, color: 'var(--fg-2)', fontSize: 13 }}>{opp.Category__c ?? '—'}</td>
                <td style={{ ...TD, width: 110, textAlign: 'center' }}><BoolCell value={opp.Do_Not_Auto_Renew__c} /></td>
                <td style={{ ...TD, width: 300, color: 'var(--fg-2)', fontSize: 13 }}>{opp['Pricebook2.Name'] ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.ARR_Basis__c} code={opp.CurrencyIsoCode ?? 'AUD'} nzdValue={opp.ARR_Basis_NZD__c} /></td>
                <td style={{ ...AMT_TD, width: 150, color: 'var(--fg-3)' }}>—</td>
                <td style={{ ...AMT_TD, width: 130, color: 'var(--fg-3)' }}>—</td>
                <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.Booked_ARR__c} code={opp.CurrencyIsoCode ?? 'AUD'} nzdValue={opp.Booked_ARR_NZD__c} /></td>
                <td style={{ ...AMT_TD, width: 120 }}><CurrencyPairCell value={opp.Net_ARR__c} code={opp.CurrencyIsoCode ?? 'AUD'} nzdValue={opp.Net_ARR_NZD__c} signed /></td>
                <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.NextStep} /></td>
                <td style={{ ...TD, width: 360 }}><span style={{ color: 'var(--fg-3)' }}>—</span></td>
                <td style={{ ...TD, width: 360 }}><LongTextCell value={opp.Expansion_Notes__c} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
