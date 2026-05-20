import type { Opportunity } from '@/lib/types'
import { SQL_RULES } from '@/lib/rules'
import { COL } from '@/lib/tableColumns'
import { nzd } from '@/lib/formatters'
import { FS } from '@/lib/fontSizes'
import SalesforceLink from '@/components/ui/SalesforceLink'
import DatePill from '@/components/ui/DatePill'
import FlagBadge from '@/components/ui/FlagBadge'
import TruncatedText from '@/components/ui/TruncatedText'
import RulesSummary from './RulesSummary'

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

export default function SQLHealthSection({ opps }: Props) {
  const noNextMeeting = opps.filter(o => o.sqlBucket !== 'Demo Scheduled')
  const scheduled = opps.filter(o => o.sqlBucket === 'Demo Scheduled')

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 24,
      marginBottom: 24,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>SQL Health</h2>
        <span style={{ ...FS.base, color: 'var(--fg-2)' }}>
          {noNextMeeting.length === 0
            ? 'All clean'
            : `${noNextMeeting.length} of ${opps.length} have no next meeting scheduled`}
        </span>
        {scheduled.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 10px', borderRadius: 999,
            background: 'var(--green-50)', color: 'var(--green-700)',
            border: '1px solid rgba(34,158,72,0.18)',
            ...FS.badge, fontWeight: 600,
          }}>
            {scheduled.length} demo{scheduled.length > 1 ? 's' : ''} scheduled
          </span>
        )}
      </header>

      <RulesSummary rules={SQL_RULES} opps={opps} />

      {noNextMeeting.length === 0 ? (
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
          All qualifying opps have next meetings scheduled.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1450, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
                <th style={{ ...TH, ...COL.owner }}>Owner</th>
                <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
                <th style={{ ...TH, ...COL.date }}>Close Date</th>
                <th style={{ ...TH, ...COL.age }}>Age</th>
                <th style={{ ...TH, ...COL.date }}>Demo Held</th>
                <th style={{ ...TH, ...COL.date }}>Next Meeting</th>
                <th style={{ ...TH, ...COL.freeText }}>Next Step</th>
                <th style={{ ...TH, ...COL.flags }}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {noNextMeeting.map(opp => (
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
                  <td style={{ ...TD, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {`${opp.ageInDays}d`}
                  </td>
                  <td style={{ ...TD }}>
                    {opp.Last_Meeting_Date__c
                      ? <DatePill date={opp.Last_Meeting_Date__c} />
                      : <span style={{ color: 'var(--red-600)', fontWeight: 600, ...FS.body }}>No</span>}
                  </td>
                  <td style={{ ...TD }}>
                    {opp.Next_Meeting_Date__c
                      ? <DatePill date={opp.Next_Meeting_Date__c} />
                      : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                  </td>
                  <td style={{ ...TD, color: 'var(--fg-2)', ...COL.freeText }}>
                    <TruncatedText text={opp.NextStep} />
                  </td>
                  <td style={{ ...TD, ...COL.flags }}>
                    <FlagBadge flag={opp.sqlBucket === 'No Demo' ? 'No demo activity' : 'No next meeting'} />
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
