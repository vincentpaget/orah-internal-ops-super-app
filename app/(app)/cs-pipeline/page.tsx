import { MOCK_RENEWALS, MOCK_EXPANSIONS } from '@/lib/mockData'
import { getPeriodRange } from '@/lib/pipeline'
import { getRenewalFlags } from '@/lib/csHygiene'
import CsPipelineShell from '@/components/cs-pipeline/CsPipelineShell'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'

interface Props {
  searchParams: Promise<{
    view?: string
    stage?: string
    owner?: string
    rep?: string
    datePreset?: string
    from?: string
    to?: string
    recordType?: string
    types?: string
    stages?: string
    pricebooks?: string
    autoRenewalDir?: string
    widget?: string
    tile?: string
  }>
}

const EXCLUDED_ACCOUNT = '0017F00000XJtiAQAT'

const OPEN_RENEWAL_STAGES  = new Set(['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'])
const OPEN_EXPANSION_STAGES = new Set(['Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'])
const ACTIVE_PB_NAMES       = new Set(['2026 Q1 - Boarding Platform', '2026 Q1 - Supervise Platform'])

export default async function CsPipelinePage({ searchParams }: Props) {
  const { view = 'all', stage, owner, rep, datePreset, from: rawFrom, to: rawTo, recordType, types: typesParam, stages: stagesParam, pricebooks: pricebooksParam, autoRenewalDir, widget, tile } = await searchParams
  const activeTypes = typesParam ? typesParam.split(',').filter(Boolean) : []
  const activeStages = stagesParam ? stagesParam.split(',').filter(Boolean) : []
  const activePricebooks = pricebooksParam ? pricebooksParam.split(',').filter(Boolean) : []
  const year = new Date().getFullYear().toString()

  const isHygieneView = view === 'hygiene'
  const isRevOpsView = view === 'revops'
  const isClosingSoonView = view === 'closing-soon'
  const isRenewalsView = !['expansions', 'all', 'hygiene', 'revops', 'closing-soon'].includes(view)
  const isExpansionsView = view === 'expansions'
  const isAllView = ['all', 'hygiene', 'revops'].includes(view)

  let sfError: string | null = null
  let renewalOpps: SFRenewalOpp[] = MOCK_RENEWALS
  let expansionOpps: SFExpansionOpp[] = MOCK_EXPANSIONS

  if (process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN) {
    try {
      const { fetchRenewals, fetchExpansions } = await import('@/lib/salesforce')
      if (isRenewalsView || isAllView || isClosingSoonView) {
        renewalOpps = await fetchRenewals(year)
      }
      if (isExpansionsView || isAllView) {
        expansionOpps = await fetchExpansions(year)
      }
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  // Always exclude internal account
  renewalOpps   = renewalOpps.filter(o => o.AccountId !== EXCLUDED_ACCOUNT)
  expansionOpps = expansionOpps.filter(o => o.AccountId !== EXCLUDED_ACCOUNT)

  const activeDatePreset = datePreset ?? 'next_90_days'

  // Resolve date range from preset or custom (not used for hygiene)
  let resolvedFrom: string | null = null
  let resolvedTo:   string | null = null
  if (activeDatePreset && activeDatePreset !== 'custom') {
    const range = getPeriodRange(activeDatePreset)
    resolvedFrom = range.start
    resolvedTo   = range.end
  } else if (activeDatePreset === 'custom') {
    resolvedFrom = rawFrom ?? null
    resolvedTo   = rawTo   ?? null
  }

  // Compute unique owners, types, stages, pricebooks before filtering (so controls always show full list)
  const renewalOwners    = [...new Set(renewalOpps.map(o => o['Owner.Name']))].sort()
  const expansionOwners  = [...new Set(expansionOpps.map(o => o['Owner.Name']))].sort()
  const renewalTypes     = [...new Set(renewalOpps.map(o => o.Type).filter((t): t is string => !!t))].sort()
  const expansionTypes   = [...new Set(expansionOpps.map(o => o.Type).filter((t): t is string => !!t))].sort()
  const availableStages  = [...new Set([...renewalOpps.map(o => o.StageName), ...expansionOpps.map(o => o.StageName)])].sort()
  const availablePricebooks = [...new Set([
    ...renewalOpps.map(o => o['Pricebook2.Name']).filter((p): p is string => !!p),
    ...expansionOpps.map(o => o['Pricebook2.Name']).filter((p): p is string => !!p),
  ])].sort()

  // Owner filter applies to all views including Zero Board
  if (owner) {
    renewalOpps   = renewalOpps.filter(o => o['Owner.Name'] === owner)
    expansionOpps = expansionOpps.filter(o => o['Owner.Name'] === owner)
  }

  // Date range filter (applied before widget counts so widgets reflect current period)
  if (resolvedFrom) {
    renewalOpps   = renewalOpps.filter(o => o.CloseDate >= resolvedFrom!)
    expansionOpps = expansionOpps.filter(o => o.CloseDate >= resolvedFrom!)
  }
  if (resolvedTo) {
    renewalOpps   = renewalOpps.filter(o => o.CloseDate <= resolvedTo!)
    expansionOpps = expansionOpps.filter(o => o.CloseDate <= resolvedTo!)
  }

  // Tile counts for Renewals Closing Soon — computed after owner+date, before type / tile filters
  const tileCounts = {
    total:        renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName)).length,
    pending_auto:  renewalOpps.filter(o => o.StageName === 'Pending' && o.Do_Not_Auto_Renew__c === false).length,
    flagged_auto:  renewalOpps.filter(o => o.StageName === 'Pending' && o.Do_Not_Auto_Renew__c === false && getRenewalFlags(o).length > 0).length,
    do_not_auto:  renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName) && o.Do_Not_Auto_Renew__c === true).length,
    in_progress:  renewalOpps.filter(o => o.StageName !== 'Pending' && OPEN_RENEWAL_STAGES.has(o.StageName)).length,
  }

  // Widget counts — computed after owner+date, before record type / type / RevOps manual filters
  const widgetCounts = {
    auto_renewal_lte_zero: renewalOpps.filter(o =>
      OPEN_RENEWAL_STAGES.has(o.StageName) && (o.Auto_Renewal_Net_ARR__c ?? 1) <= 0
    ).length,
    inactive_pricebook:
      renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName) && !ACTIVE_PB_NAMES.has(o['Pricebook2.Name'] ?? '')).length +
      expansionOpps.filter(o => OPEN_EXPANSION_STAGES.has(o.StageName) && !ACTIVE_PB_NAMES.has(o['Pricebook2.Name'] ?? '')).length,
  }

  // Record type + type filters: non-hygiene views only
  if (!isHygieneView) {
    if (isClosingSoonView || recordType === 'renewals') expansionOpps = []
    else if (recordType === 'expansions') renewalOpps = []

    if (activeTypes.length > 0) {
      renewalOpps   = renewalOpps.filter(o => activeTypes.includes(o.Type ?? ''))
      expansionOpps = expansionOpps.filter(o => activeTypes.includes(o.Type ?? ''))
    }
  }

  // Snapshot pre-tile opps for the rep breakdown (owner + date + type filters applied, tile not yet applied)
  const closingSoonBaseOpps = isClosingSoonView ? [...renewalOpps] : []

  // Closing Soon tile filter
  if (isClosingSoonView) {
    if (tile === 'pending_auto') {
      renewalOpps = renewalOpps.filter(o => o.StageName === 'Pending' && o.Do_Not_Auto_Renew__c === false)
    } else if (tile === 'flagged_auto') {
      renewalOpps = renewalOpps.filter(o => o.StageName === 'Pending' && o.Do_Not_Auto_Renew__c === false && getRenewalFlags(o).length > 0)
    } else if (tile === 'do_not_auto') {
      renewalOpps = renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName) && o.Do_Not_Auto_Renew__c === true)
    } else if (tile === 'in_progress') {
      renewalOpps = renewalOpps.filter(o => o.StageName !== 'Pending' && OPEN_RENEWAL_STAGES.has(o.StageName))
    } else {
      renewalOpps = renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName))
    }
  }

  // RevOps-specific filters — widget sets base filter, non-locked manual filters stack on top
  if (isRevOpsView) {
    if (widget === 'auto_renewal_lte_zero') {
      // Base: renewals, open stage, auto-renewal ≤ 0
      expansionOpps = []
      renewalOpps   = renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName) && (o.Auto_Renewal_Net_ARR__c ?? 1) <= 0)
      // Stack: stage and pricebook unlocked; autoRenewalDir locked by widget
      if (activeStages.length > 0)     renewalOpps = renewalOpps.filter(o => activeStages.includes(o.StageName))
      if (activePricebooks.length > 0) renewalOpps = renewalOpps.filter(o => activePricebooks.includes(o['Pricebook2.Name'] ?? ''))
    } else if (widget === 'inactive_pricebook') {
      // Base: open stage, pricebook not in active set
      renewalOpps   = renewalOpps.filter(o => OPEN_RENEWAL_STAGES.has(o.StageName) && !ACTIVE_PB_NAMES.has(o['Pricebook2.Name'] ?? ''))
      expansionOpps = expansionOpps.filter(o => OPEN_EXPANSION_STAGES.has(o.StageName) && !ACTIVE_PB_NAMES.has(o['Pricebook2.Name'] ?? ''))
      // Stack: stage and autoRenewalDir unlocked; pricebook locked by widget
      if (activeStages.length > 0) {
        renewalOpps   = renewalOpps.filter(o => activeStages.includes(o.StageName))
        expansionOpps = expansionOpps.filter(o => activeStages.includes(o.StageName))
      }
      if (autoRenewalDir === 'positive')      renewalOpps = renewalOpps.filter(o => (o.Auto_Renewal_Net_ARR__c ?? 0) > 0)
      else if (autoRenewalDir === 'negative') renewalOpps = renewalOpps.filter(o => (o.Auto_Renewal_Net_ARR__c ?? 0) < 0)
    } else {
      if (activeStages.length > 0) {
        renewalOpps   = renewalOpps.filter(o => activeStages.includes(o.StageName))
        expansionOpps = expansionOpps.filter(o => activeStages.includes(o.StageName))
      }
      if (activePricebooks.length > 0) {
        renewalOpps   = renewalOpps.filter(o => activePricebooks.includes(o['Pricebook2.Name'] ?? ''))
        expansionOpps = expansionOpps.filter(o => activePricebooks.includes(o['Pricebook2.Name'] ?? ''))
      }
      if (autoRenewalDir === 'positive') {
        renewalOpps = renewalOpps.filter(o => (o.Auto_Renewal_Net_ARR__c ?? 0) > 0)
      } else if (autoRenewalDir === 'negative') {
        renewalOpps = renewalOpps.filter(o => (o.Auto_Renewal_Net_ARR__c ?? 0) < 0)
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>
          CS Pipeline
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 6 }}>
          Renewal and expansion pipeline for {year}. Click a stage to filter.
        </p>
      </div>

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

      <CsPipelineShell
        renewalOpps={renewalOpps}
        expansionOpps={expansionOpps}
        activeView={view}
        activeStage={stage ?? null}
        renewalOwners={renewalOwners}
        expansionOwners={expansionOwners}
        renewalTypes={renewalTypes}
        expansionTypes={expansionTypes}
        activeOwner={owner ?? null}
        activeDatePreset={activeDatePreset}
        activeFrom={resolvedFrom}
        activeTo={resolvedTo}
        activeRecordType={recordType ?? null}
        activeTypes={activeTypes}
        activeRep={rep ?? null}
        availableStages={availableStages}
        activeStages={activeStages}
        availablePricebooks={availablePricebooks}
        activePricebooks={activePricebooks}
        activeAutoRenewalDir={autoRenewalDir ?? null}
        activeWidget={widget ?? null}
        widgetCounts={widgetCounts}
        activeTile={tile ?? null}
        tileCounts={tileCounts}
        closingSoonBaseOpps={closingSoonBaseOpps}
      />
    </div>
  )
}
