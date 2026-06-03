'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'
import StageBar from './StageBar'
import RenewalsTable from './RenewalsTable'
import ExpansionsTable from './ExpansionsTable'
import AllDealsTable from './AllDealsTable'
import ClosingSoonRenewalsTable from './ClosingSoonRenewalsTable'
import RenewalsDueSoonTable from './RenewalsDueSoonTable'
import RepBreakdownWidget from './RepBreakdownWidget'
import CsZeroBoard from './CsZeroBoard'
import CsFilters from './CsFilters'
import { FS } from '@/lib/fontSizes'

interface Props {
  renewalOpps: SFRenewalOpp[]
  expansionOpps: SFExpansionOpp[]
  activeView: string
  activeStage: string | null
  renewalOwners: string[]
  expansionOwners: string[]
  renewalTypes: string[]
  expansionTypes: string[]
  activeOwner: string | null
  activeDatePreset: string | null
  activeFrom: string | null
  activeTo: string | null
  activeRecordType: string | null
  activeTypes: string[]
  activeRep: string | null
  availableStages: string[]
  activeStages: string[]
  availablePricebooks: string[]
  activePricebooks: string[]
  activeAutoRenewalDir: string | null
  activeWidget: string | null
  widgetCounts: { auto_renewal_lte_zero: number; inactive_pricebook: number }
  activeTile: string | null
  tileCounts: { total: number; pending_auto: number; flagged_auto: number; do_not_auto: number; in_progress: number }
  closingSoonBaseOpps: SFRenewalOpp[]
}

const TYPE_ORDER = [
  'Cross Sell (New Students)',
  'Upsell (Existing Students)',
  'Price Increase',
  'Flat',
  'Contraction',
  'Churn Risk',
  'Churn Notice Given',
  'Lost',
]

function sortByTypeOrder(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

const CLOSED_LOST_GROUP = new Set(['Closed Lost', 'Closed Lost - Churned', 'Closed - Recycle', 'Closed - Disqualified'])

const RENEWAL_DISPLAY_STAGES = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost']
const EXPANSION_DISPLAY_STAGES = ['Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost']
const ALL_DISPLAY_STAGES = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost']

function stageMatches(stageName: string, displayStage: string): boolean {
  return displayStage === 'Closed Lost' ? CLOSED_LOST_GROUP.has(stageName) : stageName === displayStage
}

export type ArrMetric = 'net_arr' | 'total_arr'

function getArr(opp: SFRenewalOpp | SFExpansionOpp, metric: ArrMetric): number {
  return (metric === 'total_arr' ? opp.Booked_ARR_NZD__c : opp.Net_ARR_NZD__c) ?? 0
}


function stageFilter<T extends { StageName: string; CloseDate: string }>(
  opps: T[], stage: string, minClosedDate: string | null
): T[] {
  const base = opps.filter(o => stageMatches(o.StageName, stage))
  return (minClosedDate && stage.includes('Closed'))
    ? base.filter(o => o.CloseDate >= minClosedDate)
    : base
}

function computeRenewalStats(opps: SFRenewalOpp[], metric: ArrMetric, minClosedDate: string | null) {
  return RENEWAL_DISPLAY_STAGES.map(stage => {
    const matches = stageFilter(opps, stage, minClosedDate)
    return { name: stage, count: matches.length, totalArr: matches.reduce((s, o) => s + getArr(o, metric), 0) }
  })
}

function computeExpansionStats(opps: SFExpansionOpp[], metric: ArrMetric, minClosedDate: string | null) {
  return EXPANSION_DISPLAY_STAGES.map(stage => {
    const matches = stageFilter(opps, stage, minClosedDate)
    return { name: stage, count: matches.length, totalArr: matches.reduce((s, o) => s + getArr(o, metric), 0) }
  })
}

function computeAllStats(renewals: SFRenewalOpp[], expansions: SFExpansionOpp[], metric: ArrMetric, minClosedDate: string | null) {
  return ALL_DISPLAY_STAGES.map(stage => {
    const r = stageFilter(renewals, stage, minClosedDate)
    const e = stageFilter(expansions, stage, minClosedDate)
    return {
      name: stage,
      count: r.length + e.length,
      totalArr: r.reduce((s, o) => s + getArr(o, metric), 0) + e.reduce((s, o) => s + getArr(o, metric), 0),
    }
  })
}

function KpiWidget({ id, title, description, count, active, onClick }: {
  id: string; title: string; description: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '16px 20px',
        borderRadius: 8,
        border: `1.5px solid ${active ? 'var(--navy-900)' : 'var(--border)'}`,
        background: active ? 'var(--navy-900)' : 'var(--bg)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8, color: active ? '#fff' : 'var(--fg-1)' }}>
        {count}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: active ? 'rgba(255,255,255,0.9)' : 'var(--fg-1)' }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.6)' : 'var(--fg-3)', lineHeight: 1.4 }}>
        {description}
      </div>
    </button>
  )
}

function ViewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px',
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--navy-900)' : 'transparent',
        color: active ? '#fff' : 'var(--fg-2)',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms, color 120ms',
      }}
    >
      {label}
    </button>
  )
}

export default function CsPipelineShell({
  renewalOpps,
  expansionOpps,
  activeView,
  activeStage,
  renewalOwners,
  expansionOwners,
  renewalTypes,
  expansionTypes,
  activeOwner,
  activeDatePreset,
  activeFrom,
  activeTo,
  activeRecordType,
  activeTypes,
  activeRep,
  availableStages,
  activeStages,
  availablePricebooks,
  activePricebooks,
  activeAutoRenewalDir,
  activeWidget,
  widgetCounts,
  activeTile,
  tileCounts,
  closingSoonBaseOpps,
}: Props) {
  const router = useRouter()
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [metric, setMetric] = useState<ArrMetric>('net_arr')

  function handleSync() {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    router.refresh()
    setTimeout(() => {
      setSyncState('done')
      setTimeout(() => setSyncState('idle'), 2500)
    }, 900)
  }

  function switchView(targetView: string) {
    const p = new URLSearchParams()
    p.set('view', targetView)
    if (activeOwner) p.set('owner', activeOwner)
    if (targetView === 'renewals') p.set('recordType', 'renewals')
    else if (targetView === 'expansions') p.set('recordType', 'expansions')
    else if (targetView !== 'hygiene' && targetView !== 'revops' && targetView !== 'closing-soon' && targetView !== 'renewal-due-soon' && activeRecordType) p.set('recordType', activeRecordType)
    if (targetView !== 'hygiene' && activeTypes.length > 0) p.set('types', activeTypes.join(','))
    if (activeDatePreset) {
      p.set('datePreset', activeDatePreset)
      if (activeDatePreset === 'custom' && activeFrom) p.set('from', activeFrom)
      if (activeDatePreset === 'custom' && activeTo) p.set('to', activeTo)
    }
    router.push(`/cs-pipeline?${p.toString()}`)
  }

  function handleWidgetClick(widgetId: string) {
    const p = new URLSearchParams()
    p.set('view', 'revops')
    if (activeOwner) p.set('owner', activeOwner)
    if (activeDatePreset) {
      p.set('datePreset', activeDatePreset)
      if (activeDatePreset === 'custom' && activeFrom) p.set('from', activeFrom)
      if (activeDatePreset === 'custom' && activeTo) p.set('to', activeTo)
    }
    if (activeWidget !== widgetId) p.set('widget', widgetId)
    router.push(`/cs-pipeline?${p.toString()}`)
  }

  function handleTileClick(tileId: string) {
    const p = new URLSearchParams()
    p.set('view', activeView)
    if (activeOwner) p.set('owner', activeOwner)
    if (activeDatePreset) {
      p.set('datePreset', activeDatePreset)
      if (activeDatePreset === 'custom' && activeFrom) p.set('from', activeFrom)
      if (activeDatePreset === 'custom' && activeTo) p.set('to', activeTo)
    }
    if (activeTypes.length > 0) p.set('types', activeTypes.join(','))
    if (tileId !== 'total' && activeTile !== tileId) p.set('tile', tileId)
    router.push(`/cs-pipeline?${p.toString()}`)
  }

  // All current filter params except stage — passed to StageBar so stage clicks preserve filters
  function buildFilterSearch() {
    const p = new URLSearchParams()
    p.set('view', activeView)
    if (activeOwner) p.set('owner', activeOwner)
    if (activeDatePreset) p.set('datePreset', activeDatePreset)
    if (activeDatePreset === 'custom' && activeFrom) p.set('from', activeFrom)
    if (activeDatePreset === 'custom' && activeTo) p.set('to', activeTo)
    if (activeRecordType) p.set('recordType', activeRecordType)
    if (activeTypes.length > 0) p.set('types', activeTypes.join(','))
    return p.toString()
  }
  const filterSearch = buildFilterSearch()

  const isExpansions = activeView === 'expansions'
  const isAll = activeView === 'all'
  const isHygiene = activeView === 'hygiene'
  const isRevOps = activeView === 'revops'
  const isClosingSoon = activeView === 'closing-soon'
  const isRenewalsDueSoon = activeView === 'renewal-due-soon'
  const isRenewals = !isExpansions && !isAll && !isHygiene && !isRevOps && !isClosingSoon && !isRenewalsDueSoon

  const todayStr = new Date().toISOString().slice(0, 10)
  const minClosedDate = activeDatePreset?.startsWith('next_') ? todayStr : null

  const renewalStats   = computeRenewalStats(renewalOpps, metric, minClosedDate)
  const expansionStats = computeExpansionStats(expansionOpps, metric, minClosedDate)
  const allStats       = computeAllStats(renewalOpps, expansionOpps, metric, minClosedDate)

  const filteredRenewals = activeStage
    ? renewalOpps.filter(o => stageMatches(o.StageName, activeStage))
    : renewalOpps.filter(o => !o.StageName.includes('Closed'))

  const filteredExpansions = activeStage
    ? expansionOpps.filter(o => stageMatches(o.StageName, activeStage))
    : expansionOpps.filter(o => !o.StageName.includes('Closed'))

  const count = isRevOps
    ? renewalOpps.length + expansionOpps.length
    : (isClosingSoon || isRenewalsDueSoon)
      ? renewalOpps.length
      : isAll
        ? filteredRenewals.length + filteredExpansions.length
        : isRenewals ? filteredRenewals.length : filteredExpansions.length

  const owners = (isAll || isHygiene || isRevOps)
    ? [...new Set([...renewalOwners, ...expansionOwners])].sort()
    : (isRenewals || isClosingSoon || isRenewalsDueSoon) ? renewalOwners : expansionOwners

  const availableTypes = sortByTypeOrder(
    (isAll || isRevOps)
      ? [...new Set([...renewalTypes, ...expansionTypes])]
      : (isRenewals || isClosingSoon || isRenewalsDueSoon) ? renewalTypes : expansionTypes
  )

  return (
    <div>
      {/* View toggle + sync button */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Pipeline Views
            </div>
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <ViewTab label="All Deals" active={isAll} onClick={() => switchView('all')} />
              <ViewTab label="Renewals" active={isRenewals} onClick={() => switchView('renewals')} />
              <ViewTab label="Expansions" active={isExpansions} onClick={() => switchView('expansions')} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Custom Dashboards
            </div>
            <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <ViewTab label="Pipeline Hygiene" active={isHygiene} onClick={() => switchView('hygiene')} />
              <ViewTab label="Renewals Closing Soon" active={isClosingSoon} onClick={() => switchView('closing-soon')} />
              <ViewTab label="Renewals Due Soon" active={isRenewalsDueSoon} onClick={() => switchView('renewal-due-soon')} />
              <ViewTab label="RevOps" active={isRevOps} onClick={() => switchView('revops')} />
            </div>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncState === 'syncing'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 6,
            border: `1px solid ${syncState === 'done' ? 'rgba(34,158,72,0.4)' : 'var(--border)'}`,
            background: syncState === 'done' ? 'var(--green-50)' : 'var(--bg)',
            color: syncState === 'done' ? 'var(--green-700)' : syncState === 'syncing' ? 'var(--fg-3)' : 'var(--fg-2)',
            fontSize: 13, fontWeight: 500, cursor: syncState === 'syncing' ? 'default' : 'pointer',
            fontFamily: 'inherit', transition: 'background 200ms, border-color 200ms, color 200ms',
          }}
          onMouseEnter={e => { if (syncState === 'idle') { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' } }}
          onMouseLeave={e => { if (syncState === 'idle') { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' } }}
        >
          {syncState === 'syncing' ? '↺ Syncing…' : syncState === 'done' ? '✓ Synced' : '↺ Sync with Salesforce'}
        </button>
      </div>

      {/* KPI widgets — RevOps only, shown before filters */}
      {isRevOps && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, maxWidth: 780 }}>
          <KpiWidget
            id="auto_renewal_lte_zero"
            title="Auto-Renewal Net ARR ≤ 0"
            description="Renewals in open stages with negative or zero auto-renewal ARR"
            count={widgetCounts.auto_renewal_lte_zero}
            active={activeWidget === 'auto_renewal_lte_zero'}
            onClick={() => handleWidgetClick('auto_renewal_lte_zero')}
          />
          <KpiWidget
            id="inactive_pricebook"
            title="Inactive Pricebook"
            description="Open deals not on a 2026 Q1 pricebook"
            count={widgetCounts.inactive_pricebook}
            active={activeWidget === 'inactive_pricebook'}
            onClick={() => handleWidgetClick('inactive_pricebook')}
          />
        </div>
      )}

      {/* Filters */}
      <CsFilters
        owners={owners}
        availableTypes={availableTypes}
        activeOwner={activeOwner}
        activeDatePreset={activeDatePreset}
        activeFrom={activeFrom}
        activeTo={activeTo}
        activeRecordType={activeRecordType}
        activeTypes={activeTypes}
        activeView={activeView}
        activeStage={activeStage}
        showRecordType={!isHygiene}
        showType={!isHygiene}
        lockedRecordType={isRenewals || isClosingSoon || isRenewalsDueSoon ? 'renewals' : isExpansions ? 'expansions' : undefined}
        dateLabel={isRenewalsDueSoon ? 'Renewal date' : 'Close date'}
        showRevOpsFilters={isRevOps}
        availableStages={availableStages}
        activeStages={activeStages}
        availablePricebooks={availablePricebooks}
        activePricebooks={activePricebooks}
        activeAutoRenewalDir={activeAutoRenewalDir}
        activeWidget={activeWidget}
        activeTile={activeTile}
      />

      {isHygiene ? (
        <CsZeroBoard renewalOpps={renewalOpps} expansionOpps={expansionOpps} activeRep={activeRep} />
      ) : isClosingSoon ? (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, maxWidth: 1040 }}>
            <KpiWidget
              id="total"
              title="Total Renewals"
              description="All open renewals in the current period"
              count={tileCounts.total}
              active={activeTile === null}
              onClick={() => handleTileClick('total')}
            />
            <KpiWidget
              id="pending_auto"
              title="Pending Auto-Renewals"
              description="Stage is Pending, Do Not Auto Renew is off"
              count={tileCounts.pending_auto}
              active={activeTile === 'pending_auto'}
              onClick={() => handleTileClick('pending_auto')}
            />
            <KpiWidget
              id="flagged_auto"
              title="Flagged Auto-Renewals"
              description="Pending auto-renewals with 1 or more hygiene flags"
              count={tileCounts.flagged_auto}
              active={activeTile === 'flagged_auto'}
              onClick={() => handleTileClick('flagged_auto')}
            />
            <KpiWidget
              id="do_not_auto"
              title="Do Not Auto Renew"
              description="Any open stage with Do Not Auto Renew enabled"
              count={tileCounts.do_not_auto}
              active={activeTile === 'do_not_auto'}
              onClick={() => handleTileClick('do_not_auto')}
            />
            <KpiWidget
              id="in_progress"
              title="Renewals In Progress"
              description="Active stage — not pending or closed"
              count={tileCounts.in_progress}
              active={activeTile === 'in_progress'}
              onClick={() => handleTileClick('in_progress')}
            />
          </div>
          <RepBreakdownWidget opps={closingSoonBaseOpps} />
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>
                {activeTile === 'pending_auto' ? 'Pending Auto-Renewals'
                  : activeTile === 'flagged_auto' ? 'Flagged Auto-Renewals'
                  : activeTile === 'do_not_auto' ? 'Do Not Auto Renew'
                  : activeTile === 'in_progress' ? 'Renewals In Progress'
                  : 'All Open Renewals'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 8px', borderRadius: 999,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
              }}>
                {count} deal{count !== 1 ? 's' : ''}
              </span>
            </div>
            <ClosingSoonRenewalsTable opps={renewalOpps} activeTile={activeTile} />
          </div>
        </>
      ) : isRenewalsDueSoon ? (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, maxWidth: 1040 }}>
            <KpiWidget
              id="total"
              title="Total Renewals"
              description="All open renewals in the current period"
              count={tileCounts.total}
              active={activeTile === null}
              onClick={() => handleTileClick('total')}
            />
            <KpiWidget
              id="pending_auto"
              title="Pending Auto-Renewals"
              description="Stage is Pending, Do Not Auto Renew is off"
              count={tileCounts.pending_auto}
              active={activeTile === 'pending_auto'}
              onClick={() => handleTileClick('pending_auto')}
            />
            <KpiWidget
              id="flagged_auto"
              title="Flagged Auto-Renewals"
              description="Pending auto-renewals with 1 or more hygiene flags"
              count={tileCounts.flagged_auto}
              active={activeTile === 'flagged_auto'}
              onClick={() => handleTileClick('flagged_auto')}
            />
            <KpiWidget
              id="do_not_auto"
              title="Do Not Auto Renew"
              description="Any open stage with Do Not Auto Renew enabled"
              count={tileCounts.do_not_auto}
              active={activeTile === 'do_not_auto'}
              onClick={() => handleTileClick('do_not_auto')}
            />
            <KpiWidget
              id="in_progress"
              title="Renewals In Progress"
              description="Active stage — not pending or closed"
              count={tileCounts.in_progress}
              active={activeTile === 'in_progress'}
              onClick={() => handleTileClick('in_progress')}
            />
          </div>
          <RepBreakdownWidget opps={closingSoonBaseOpps} />
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>
                {activeTile === 'pending_auto' ? 'Pending Auto-Renewals'
                  : activeTile === 'flagged_auto' ? 'Flagged Auto-Renewals'
                  : activeTile === 'do_not_auto' ? 'Do Not Auto Renew'
                  : activeTile === 'in_progress' ? 'Renewals In Progress'
                  : 'All Open Renewals'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 8px', borderRadius: 999,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
              }}>
                {count} deal{count !== 1 ? 's' : ''}
              </span>
            </div>
            <RenewalsDueSoonTable opps={renewalOpps} activeTile={activeTile} />
          </div>
        </>
      ) : isRevOps ? (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>RevOps</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '1px 8px', borderRadius: 999,
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
            }}>
              {count} deal{count !== 1 ? 's' : ''}
            </span>
          </div>
          <AllDealsTable renewals={renewalOpps} expansions={expansionOpps} />
        </div>
      ) : (
        <>
          {/* Stage summary bar */}
          <StageBar
            stats={isAll ? allStats : isRenewals ? renewalStats : expansionStats}
            activeStage={activeStage}
            filterSearch={filterSearch}
            metric={metric}
            onMetricChange={setMetric}
          />

          {/* Table card */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ ...FS.heading, fontWeight: 600, color: 'var(--fg-1)' }}>
                {activeStage ?? (isAll ? 'All Deals' : isRenewals ? 'All Renewals' : 'All Expansions')}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 8px', borderRadius: 999,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
              }}>
                {count} deal{count !== 1 ? 's' : ''}
              </span>
            </div>

            {isAll
              ? <AllDealsTable renewals={filteredRenewals} expansions={filteredExpansions} />
              : isRenewals
                ? <RenewalsTable opps={filteredRenewals} activeStage={activeStage} />
                : <ExpansionsTable opps={filteredExpansions} />
            }
          </div>
        </>
      )}
    </div>
  )
}
