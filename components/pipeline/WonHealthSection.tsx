import type { Opportunity } from '@/lib/types'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import SalesforceLink from '@/components/ui/SalesforceLink'
import FlagBadge from '@/components/ui/FlagBadge'
import DatePill from '@/components/ui/DatePill'

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
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border-subtle)',
}

export default function WonHealthSection({ opps }: Props) {
  const flagged = opps.filter(o => o.flags.length > 0)
  const summary = flagged.length === 0
    ? 'All clean'
    : `${flagged.length} of ${opps.length} missing won reason`

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 24,
      marginBottom: 24,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>Won Health</h2>
        <span style={{ ...FS.base, color: 'var(--fg-2)' }}>{summary}</span>
      </header>

      {flagged.length === 0 ? (
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
          All closed won opportunities have won reasons recorded.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 800, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
                <th style={{ ...TH, ...COL.owner }}>Owner</th>
                <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
                <th style={{ ...TH, ...COL.date }}>Close Date</th>
                <th style={{ ...TH, ...COL.flags }}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map(opp => (
                <tr key={opp.Id} style={{ transition: 'background 120ms' }}>
                  <td style={{ ...TD, ...COL.opportunity }}>
                    <SalesforceLink label={opp.Name} opportunityId={opp.Id} />
                  </td>
                  <td style={{ ...TD, color: 'var(--fg-2)' }}>
                    {opp['Owner.Name']}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--fg-1)' }}>
                    {nzd(opp.Net_ARR_NZD__c)}
                  </td>
                  <td style={{ ...TD }}>
                    <DatePill date={opp.CloseDate} />
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
      )}
    </section>
  )
}
