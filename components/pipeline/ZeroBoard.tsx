'use client'

import { useState } from 'react'
import type { Opportunity } from '@/lib/types'
import type { RuleDefinition } from '@/lib/rules'
import { SQO_RULES, SAO_RULES, SQL_RULES, WON_RULES, LOST_RULES } from '@/lib/rules'
import { nzd } from '@/lib/formatters'
import RulesSummary from './RulesSummary'
import SQOHealthTable from './SQOHealthTable'
import SAOHealthTable from './SAOHealthTable'
import { COL } from '@/lib/tableColumns'
import { FS } from '@/lib/fontSizes'
import SalesforceLink from '@/components/ui/SalesforceLink'
import FlagBadge from '@/components/ui/FlagBadge'
import DatePill from '@/components/ui/DatePill'
import StageTag from '@/components/ui/StageTag'
import TruncatedText from '@/components/ui/TruncatedText'

interface Props {
  sqoOpps: Opportunity[]
  saoOpps: Opportunity[]
  sqlOpps: Opportunity[]
  wonOpps: Opportunity[]
  lostOpps: Opportunity[]
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

function SQLTable({ opps }: { opps: Opportunity[] }) {
  const failing = opps.filter(o => o.sqlBucket !== 'Demo Scheduled' || o.flags.length > 0)
  if (failing.length === 0) return null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1350, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
            <th style={{ ...TH, ...COL.owner }}>Owner</th>
            <th style={{ ...TH, ...COL.stage }}>Stage</th>
            <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
            <th style={{ ...TH, ...COL.date }}>Close Date</th>
            <th style={{ ...TH, ...COL.age }}>Age</th>
            <th style={{ ...TH, ...COL.date }}>Demo Held</th>
            <th style={{ ...TH, ...COL.date }}>Next Meeting</th>
            <th style={{ ...TH, ...COL.flags }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {failing.map(opp => (
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
              <td style={{ ...TD, ...COL.flags }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {opp.sqlBucket !== 'Demo Scheduled' && (
                    <FlagBadge flag={opp.sqlBucket === 'No Demo' ? 'No demo activity' : 'No next meeting'} />
                  )}
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

function WonTable({ opps }: { opps: Opportunity[] }) {
  const failing = opps.filter(o => o.flags.length > 0)
  if (failing.length === 0) return null

  return (
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
          {failing.map(opp => (
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
  )
}

function LostTable({ opps }: { opps: Opportunity[] }) {
  const failing = opps.filter(o => o.flags.length > 0)
  if (failing.length === 0) return null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1450, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...TH, ...COL.opportunity }}>Opportunity</th>
            <th style={{ ...TH, ...COL.owner }}>Owner</th>
            <th style={{ ...TH, ...COL.stage }}>Stage</th>
            <th style={{ ...TH, ...COL.arr, textAlign: 'right' }}>ARR NZD</th>
            <th style={{ ...TH, ...COL.date }}>Close Date</th>
            <th style={{ ...TH, ...COL.shortEnum }}>Loss Reason</th>
            <th style={{ ...TH, ...COL.freeText }}>Loss Detail</th>
            <th style={{ ...TH, ...COL.shortEnum }}>Lost From Stage</th>
            <th style={{ ...TH, ...COL.flags }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {failing.map(opp => (
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
              <td style={{ ...TD, color: 'var(--fg-2)' }}>
                {opp.Loss_Reason__c ?? <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>Not set</span>}
              </td>
              <td style={{ ...TD, color: 'var(--fg-2)', ...COL.freeText }}>
                <TruncatedText
                  text={opp.Loss_Reason_Detail__c}
                  fallback={<span style={{ color: 'var(--red-600)', fontWeight: 600 }}>Not set</span>}
                />
              </td>
              <td style={{ ...TD, color: 'var(--fg-2)' }}>
                {opp.Lost_From_Stage__c ?? <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>Not set</span>}
              </td>
              <td style={{ ...TD }}>
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

function CategoryGroup({
  title,
  subtitle,
  allOpps,
  rules,
  accentColor,
  cleanMessage,
  children,
}: {
  title: string
  subtitle: string
  allOpps: Opportunity[]
  rules: RuleDefinition[]
  accentColor: string
  cleanMessage: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  const failingCount = allOpps.filter(opp => rules.some(r => r.check(opp))).length
  const isClean = failingCount === 0
  const hasOpps = allOpps.length > 0

  const headerBg = isClean && hasOpps
    ? 'rgba(34, 158, 72, 0.07)'
    : 'var(--bg-subtle)'
  const cardBorder = isClean && hasOpps
    ? '1px solid rgba(34, 158, 72, 0.28)'
    : '1px solid var(--border)'
  const cardAccentColor = isClean && hasOpps ? 'var(--green-500)' : accentColor

  return (
    <div style={{
      background: 'var(--bg)',
      borderRadius: 8,
      border: cardBorder,
      borderLeft: `4px solid ${cardAccentColor}`,
      overflow: 'hidden',
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px 16px 18px',
          cursor: 'pointer',
          userSelect: 'none',
          background: headerBg,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
            color: 'var(--fg-3)',
          }}
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, ...FS.base, color: 'var(--fg-1)' }}>{title}</span>

            {hasOpps && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 8px', borderRadius: 999,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                ...FS.badge, fontWeight: 600, color: 'var(--fg-2)',
              }}>
                {allOpps.length} opp{allOpps.length !== 1 ? 's' : ''}
              </span>
            )}

            {!hasOpps ? (
              <span style={{ ...FS.badge, color: 'var(--fg-3)', fontStyle: 'italic' }}>No data this quarter</span>
            ) : isClean ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 9px', borderRadius: 999,
                background: 'var(--green-50)', color: 'var(--green-700)',
                border: '1px solid rgba(34,158,72,0.18)',
                ...FS.badge, fontWeight: 600,
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                All clean
              </span>
            ) : (
              <span style={{
                padding: '2px 9px', borderRadius: 999,
                background: 'var(--red-50)', color: 'var(--red-700)',
                border: '1px solid rgba(201,17,31,0.15)',
                ...FS.badge, fontWeight: 700,
              }}>
                {failingCount} flagged
              </span>
            )}
          </div>
          <p style={{ margin: '3px 0 0', ...FS.badge, color: 'var(--fg-3)' }}>{subtitle}</p>
        </div>

        <button
          onClick={e => { e.stopPropagation(); setRulesOpen(r => !r) }}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg)',
            color: 'var(--fg-2)',
            ...FS.badge,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h9M2 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {rulesOpen ? 'Hide rules' : `Show rules (${rules.length})`}
        </button>
      </div>

      {open && (
        <div style={{ background: 'var(--bg)', borderTop: `1px solid ${isClean && hasOpps ? 'rgba(34, 158, 72, 0.2)' : 'var(--border-subtle)'}` }}>
          {rulesOpen && hasOpps && (
            <RulesSummary rules={rules} opps={allOpps} />
          )}

          {!hasOpps ? (
            <div style={{ padding: '16px 20px 20px 18px', color: 'var(--fg-3)', ...FS.base, fontStyle: 'italic' }}>
              No opportunities in this category this quarter.
            </div>
          ) : isClean ? (
            <div style={{
              margin: '8px 20px 20px 18px',
              padding: '14px 18px',
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
                <path d="M3 8l3.5 3.5L13 5" stroke="var(--green-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {cleanMessage}
            </div>
          ) : (
            <div style={{ paddingBottom: 16 }}>
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ZeroBoard({ sqoOpps, saoOpps, sqlOpps, wonOpps, lostOpps }: Props) {
  const totalFlagged =
    sqoOpps.filter(o => SQO_RULES.some(r => r.check(o))).length +
    saoOpps.filter(o => SAO_RULES.some(r => r.check(o))).length +
    sqlOpps.filter(o => SQL_RULES.some(r => r.check(o))).length +
    wonOpps.filter(o => WON_RULES.some(r => r.check(o))).length +
    lostOpps.filter(o => LOST_RULES.some(r => r.check(o))).length

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 24,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '18px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <h2 style={{ ...FS.heading, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Zero board</h2>
        {totalFlagged > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 20, padding: '0 7px', borderRadius: 999,
            background: 'var(--red-50)', color: 'var(--red-700)',
            fontWeight: 700, ...FS.badge,
            border: '1px solid rgba(201,17,31,0.15)',
          }}>
            {totalFlagged}
          </span>
        )}
        <span style={{ ...FS.body, color: 'var(--fg-3)', marginLeft: 2 }}>
          Clear every hygiene flag to zero
        </span>
      </div>

      <div style={{
        padding: 15,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
      }}>
        <CategoryGroup
          title="SQO Hygiene"
          subtitle="Sales Qualified Opportunities — Evaluation, Proposal, Negotiation, Closing"
          accentColor="var(--navy-900)"
          allOpps={sqoOpps}
          rules={SQO_RULES}
          cleanMessage="All SQO opportunities are passing hygiene rules — no flags."
        >
          <SQOHealthTable opps={sqoOpps} />
        </CategoryGroup>

        <CategoryGroup
          title="SAO Hygiene"
          subtitle="Sales Accepted Opportunities — Nurturing"
          accentColor="var(--orange-500)"
          allOpps={saoOpps}
          rules={SAO_RULES}
          cleanMessage="All SAO opportunities are passing hygiene rules — no flags."
        >
          <SAOHealthTable opps={saoOpps} />
        </CategoryGroup>

        <CategoryGroup
          title="SQL Hygiene"
          subtitle="Sales Qualified Leads — Qualifying"
          accentColor="var(--purple-500)"
          allOpps={sqlOpps}
          rules={SQL_RULES}
          cleanMessage="All qualifying opportunities have demos scheduled."
        >
          <SQLTable opps={sqlOpps} />
        </CategoryGroup>

        <CategoryGroup
          title="Won Hygiene"
          subtitle="Closed Won — win reason required"
          accentColor="var(--green-500)"
          allOpps={wonOpps}
          rules={WON_RULES}
          cleanMessage="All closed won opportunities have win reasons recorded."
        >
          <WonTable opps={wonOpps} />
        </CategoryGroup>

        <CategoryGroup
          title="Lost Hygiene"
          subtitle="Closed Lost — loss data required"
          accentColor="var(--fg-3)"
          allOpps={lostOpps}
          rules={LOST_RULES}
          cleanMessage="All closed lost opportunities have complete hygiene data."
        >
          <LostTable opps={lostOpps} />
        </CategoryGroup>
      </div>
    </section>
  )
}
