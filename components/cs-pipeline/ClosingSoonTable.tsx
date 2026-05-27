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

const CLOSED_RENEWAL_STAGES = new Set(['Closed Won', 'Closed Lost - Churned'])

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

function PipelineBadge({ kind }: { kind: 'renewal' | 'expansion' }) {
  const isRenewal = kind === 'renewal'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: isRenewal ? 'var(--blue-50)' : 'var(--green-50)', color: isRenewal ? 'var(--navy-900)' : 'var(--green-700)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
      {isRenewal ? 'Renewal' : 'Expansion'}
    </span>
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

function NetArrCell({ value, code }: { value: number | null | undefined; code: string }) {
  if (value == null) return <span style={{ color: 'var(--fg-3)' }}>—</span>
  const color = value > 0 ? 'var(--green-700)' : value < 0 ? 'var(--red-700)' : 'var(--fg-3)'
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtCurrency(value, code)}</span>
}

type Row =
  | { kind: 'renewal'; opp: SFRenewalOpp; sortKey: string }
  | { kind: 'expansion'; opp: SFExpansionOpp; sortKey: string }

export default function ClosingSoonTable({ renewals, expansions }: Props) {
  const rows: Row[] = [
    ...renewals.map(opp => ({ kind: 'renewal' as const, opp, sortKey: opp.CloseDate })),
    ...expansions.map(opp => ({ kind: 'expansion' as const, opp, sortKey: opp.CloseDate })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', ...FS.base }}>
        No opportunities closing in the next 14 days.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <table style={{ width: '100%', minWidth: 1640, borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...STICKY_TH, width: 280 }}>Opportunity</th>
            <th style={{ ...TH, width: 80 }}>Flags</th>
            <th style={{ ...TH, width: 100 }}>Pipeline</th>
            <th style={{ ...TH, width: 130 }}>Owner</th>
            <th style={{ ...TH, width: 110 }}>Close Date</th>
            <th style={{ ...TH, width: 130 }}>Stage</th>
            <th style={{ ...TH, width: 140 }}>Type</th>
            <th style={{ ...TH, width: 130 }}>Category</th>
            <th style={{ ...AMT_TH, width: 130 }}>ARR Basis</th>
            <th style={{ ...AMT_TH, width: 130 }}>Booked ARR</th>
            <th style={{ ...AMT_TH, width: 120 }}>Net ARR</th>
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
                  <td style={{ ...TD, width: 110 }}>
                    <DatePill date={opp.CloseDate} noWarning={isClosed} />
                  </td>
                  <td style={{ ...TD, width: 130, color: 'var(--fg-2)', fontSize: 13 }}>{opp.StageName}</td>
                  <td style={{ ...TD, width: 140 }}><TypeCell value={opp.Type} /></td>
                  <td style={{ ...TD, width: 130, color: 'var(--fg-3)' }}>—</td>
                  <td style={{ ...AMT_TD, width: 130, color: 'var(--fg-1)' }}>{fmtCurrency(opp.ARR_Basis__c, code)}</td>
                  <td style={{ ...AMT_TD, width: 130, color: 'var(--fg-1)' }}>{fmtCurrency(opp.Booked_ARR__c, code)}</td>
                  <td style={{ ...TD, width: 120, textAlign: 'right' }}>
                    <NetArrCell value={opp.Net_ARR__c} code={code} />
                  </td>
                </tr>
              )
            }

            const opp = row.opp
            return (
              <tr key={`e_${opp.Id}`}>
                <td style={{ ...STICKY_TD, width: 280 }}>
                  <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                </td>
                <td style={{ ...TD, width: 80 }}><FlagsCell flags={getExpansionFlags(opp)} /></td>
                <td style={{ ...TD, width: 100 }}><PipelineBadge kind="expansion" /></td>
                <td style={{ ...TD, width: 130, color: 'var(--fg-2)' }}>{opp['Owner.Name']}</td>
                <td style={{ ...TD, width: 110 }}>
                  <DatePill date={opp.CloseDate} noWarning={false} />
                </td>
                <td style={{ ...TD, width: 130, color: 'var(--fg-2)', fontSize: 13 }}>{opp.StageName}</td>
                <td style={{ ...TD, width: 140 }}><TypeCell value={opp.Type} /></td>
                <td style={{ ...TD, width: 130, color: 'var(--fg-2)', fontSize: 13 }}>{opp.Category__c ?? '—'}</td>
                <td style={{ ...AMT_TD, width: 130, color: 'var(--fg-3)' }}>—</td>
                <td style={{ ...AMT_TD, width: 130, color: 'var(--fg-3)' }}>—</td>
                <td style={{ ...TD, width: 120, textAlign: 'right' }}>
                  <NetArrCell value={opp.Net_ARR__c} code="AUD" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
