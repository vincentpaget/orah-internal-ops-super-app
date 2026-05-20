import type { Opportunity } from '@/lib/types'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import GradePill from '@/components/ui/GradePill'
import SalesforceLink from '@/components/ui/SalesforceLink'
import FlagBadge from '@/components/ui/FlagBadge'
import StageTag from '@/components/ui/StageTag'
import DatePill from '@/components/ui/DatePill'
import TruncatedText from '@/components/ui/TruncatedText'

interface Props {
  opps: Opportunity[]
}

const TH: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  color: 'var(--fg-3)',
  fontWeight: 600,
  ...FS.badge,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  background: 'transparent',
}

const TD: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
}

export default function SQOHealthTable({ opps }: Props) {
  const failing = opps.filter(o => o.flags.length > 0)

  if (failing.length === 0) {
    return (
      <div style={{
        padding: '20px 24px',
        background: 'var(--green-50)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: 'var(--green-700)',
        ...FS.base,
        border: '1px solid rgba(34,158,72,0.18)',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        All SQO opportunities are clean — no flags.
      </div>
    )
  }

  const sorted = [...failing].sort((a, b) => (b.Net_ARR_NZD__c ?? 0) - (a.Net_ARR_NZD__c ?? 0))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1600, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
            <th style={{ ...TH, ...COL.owner }}>Owner</th>
            <th style={{ ...TH, ...COL.stage }}>Stage</th>
            <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
            <th style={{ ...TH, ...COL.date }}>Close</th>
            <th style={{ ...TH, ...COL.grade }}>EB</th>
            <th style={{ ...TH, ...COL.freeText }}>EB Notes</th>
            <th style={{ ...TH, ...COL.grade }}>CE</th>
            <th style={{ ...TH, ...COL.freeText }}>CE Notes</th>
            <th style={{ ...TH, ...COL.flags }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(opp => (
            <tr key={opp.Id} style={{ transition: 'background 120ms' }}>
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
              <td style={{ ...TD }}>
                <GradePill grade={opp.Economic_Buyer__c} />
              </td>
              <td style={{ ...TD, color: 'var(--fg-2)', ...COL.freeText }}>
                <TruncatedText text={opp.Economic_Buyer_Grade_Notes__c} />
              </td>
              <td style={{ ...TD }}>
                <GradePill grade={opp.Compelling_Event__c} />
              </td>
              <td style={{ ...TD, color: 'var(--fg-2)', ...COL.freeText }}>
                <TruncatedText text={opp.Compelling_Event_Grade_Notes__c} />
              </td>
              <td style={{ ...TD, ...COL.flags }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {opp.flags.map(f => <FlagBadge key={f} flag={f} />)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
