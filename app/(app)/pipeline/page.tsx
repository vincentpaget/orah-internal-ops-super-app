import { MOCK_OPPS } from '@/lib/mockData'
import { enrichOpportunity } from '@/lib/flags'
import { nzd } from '@/lib/formatters'
import { SQO_STAGES, SAO_STAGES, OPEN_STAGES } from '@/lib/types'
import { getPeriodRange, computeRepRows } from '@/lib/pipeline'
import RepSummaryTable from '@/components/pipeline/RepSummaryTable'
import SendToSlackButton from '@/components/pipeline/SendToSlackButton'
import PipelineSummaryTable from '@/components/pipeline/PipelineSummaryTable'
import TopDealsTable from '@/components/pipeline/TopDealsTable'
import ZeroBoard from '@/components/pipeline/ZeroBoard'
import PipelineFilters from '@/components/pipeline/PipelineFilters'
import UnmappedStagesBanner from '@/components/pipeline/UnmappedStagesBanner'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ rep?: string; period?: string }>
}

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 24,
  marginBottom: 24,
}

export default async function PipelinePage({ searchParams }: Props) {
  const { rep: activeRepId, period: periodParam } = await searchParams
  const period = periodParam ?? 'this_quarter'
  const { start, end } = getPeriodRange(period)

  let sfError: string | null = null
  let rawOpps = MOCK_OPPS.filter(o => o.CloseDate >= start && o.CloseDate <= end)

  if (process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN) {
    try {
      const { fetchOpportunities } = await import('@/lib/salesforce')
      rawOpps = await fetchOpportunities(start, end)
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  const allEnriched = rawOpps.map(enrichOpportunity)
  const mappedOpps = allEnriched.filter(o => !o.unmapped)
  const unmappedOpps = allEnriched.filter(o => o.unmapped)

  const repRows = computeRepRows(mappedOpps)

  const viewOpps = activeRepId
    ? mappedOpps.filter(o => o['Owner.Id'] === activeRepId)
    : mappedOpps

  const sqoOpps  = viewOpps.filter(o => SQO_STAGES.includes(o.StageName))
  const saoOpps  = viewOpps.filter(o => SAO_STAGES.includes(o.StageName))
  const sqlOpps  = viewOpps.filter(o => o.StageName === 'Qualifying')
  const lostOpps = viewOpps.filter(o => ['Closed Lost', 'Closed - Disqualified', 'Closed - Recycled', 'Closed - Qualified Out'].includes(o.StageName))
  const wonOpps  = viewOpps.filter(o => o.StageName === 'Closed Won')
  const topDeals = sqoOpps.filter(o => (o.Net_ARR_NZD__c ?? 0) >= 20000)

  const openOpps = [...sqoOpps, ...saoOpps, ...sqlOpps]
  const totalPipelineARR = openOpps.reduce((s, o) => s + (o.Net_ARR_NZD__c ?? 0), 0)
  const flaggedOpps = openOpps.filter(o =>
    o.flags.length > 0 || (o.StageName === 'Qualifying' && o.sqlBucket !== 'Demo Scheduled')
  ).length
  const healthPct = openOpps.length > 0
    ? Math.round(((openOpps.length - flaggedOpps) / openOpps.length) * 100)
    : 100

  const activeRep = activeRepId ? repRows.find(r => r.repId === activeRepId) : null

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: activeRep ? 12 : 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>
          Pipeline hygiene
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 6 }}>
          Where each rep stands against hygiene rules. Click a rep to drill in.
        </p>
      </div>

      {/* Active rep filter bar */}
      {activeRep && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: 'var(--navy-900)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 5v2.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Currently showing</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{activeRep.repName}</span>
          </div>
          <Link
            href={`/pipeline?period=${period}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.1)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Show all reps
          </Link>
        </div>
      )}

      {/* Filters */}
      <PipelineFilters period={period} repId={activeRepId} />

      {/* Salesforce error banner */}
      {sfError && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'var(--red-50)',
          border: '1px solid rgba(201,17,31,0.2)',
          color: 'var(--red-700)',
          fontSize: 13,
        }}>
          <strong>Salesforce connection error:</strong> {sfError} — showing mock data.
        </div>
      )}

      {/* Unmapped stages warning */}
      {unmappedOpps.length > 0 && <UnmappedStagesBanner opps={unmappedOpps} />}

      {/* Hero metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Pipeline', value: nzd(totalPipelineARR), sub: 'open ARR NZD' },
          { label: 'Open Opps', value: String(openOpps.length), sub: 'across all stages' },
          { label: 'Flagged Opps', value: String(flaggedOpps), sub: 'open opps with flags', accent: flaggedOpps > 0 ? 'var(--red-700)' : 'var(--green-700)' },
          { label: 'Hygiene Score', value: `${healthPct}%`, sub: 'of open opps passing', accent: healthPct >= 80 ? 'var(--green-700)' : healthPct >= 60 ? 'var(--orange-700)' : 'var(--red-700)' },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '20px 24px',
          }}>
            <p style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
              {label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? 'var(--fg-1)', margin: '0 0 4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {value}
            </p>
            <p style={{ fontSize: 14, color: 'var(--fg-3)', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard + Pipeline by Stage side by side, same height */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <section style={{ ...CARD, marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>
                Rep leaderboard
              </h2>
              <p style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4, marginBottom: 0 }}>
                Click a row to filter the tables below
              </p>
            </div>
            <SendToSlackButton period={period} />
          </header>
          <RepSummaryTable rows={repRows} activeRepId={activeRepId} period={period} />
        </section>

        <section style={{ ...CARD, marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
          <header style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>
              Pipeline by stage
            </h2>
          </header>
          <PipelineSummaryTable opps={viewOpps} />
        </section>
      </div>

      {/* Top Deals */}
      {topDeals.length > 0 && (
        <section style={CARD}>
          <TopDealsTable opps={topDeals} />
        </section>
      )}

      <ZeroBoard sqoOpps={sqoOpps} saoOpps={saoOpps} sqlOpps={sqlOpps} wonOpps={wonOpps} lostOpps={lostOpps} />
    </div>
  )
}
