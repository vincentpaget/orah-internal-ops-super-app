import { MOCK_RENEWALS, MOCK_EXPANSIONS } from '@/lib/mockData'
import { getPeriodRange } from '@/lib/pipeline'
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
  }>
}

const EXCLUDED_ACCOUNT = '0017F00000XJtiAQAT'

export default async function CsPipelinePage({ searchParams }: Props) {
  const { view = 'all', stage, owner, rep, datePreset, from: rawFrom, to: rawTo, recordType, types: typesParam, stages: stagesParam, pricebooks: pricebooksParam, autoRenewalDir } = await searchParams
  const activeTypes = typesParam ? typesParam.split(',').filter(Boolean) : []
  const activeStages = stagesParam ? stagesParam.split(',').filter(Boolean) : []
  const activePricebooks = pricebooksParam ? pricebooksParam.split(',').filter(Boolean) : []
  const year = new Date().getFullYear().toString()

  const isHygieneView = view === 'hygiene'
  const isRevOpsView = view === 'revops'
  const isRenewalsView = !['expansions', 'all', 'hygiene', 'revops'].includes(view)
  const isExpansionsView = view === 'expansions'
  const isAllView = ['all', 'hygiene', 'revops'].includes(view)

  let sfError: string | null = null
  let renewalOpps: SFRenewalOpp[] = MOCK_RENEWALS
  let expansionOpps: SFExpansionOpp[] = MOCK_EXPANSIONS

  if (process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN) {
    try {
      const { fetchRenewals, fetchExpansions } = await import('@/lib/salesforce')
      if (isRenewalsView || isAllView) {
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

  // Record type + type filters: non-hygiene views only
  if (!isHygieneView) {
    if (recordType === 'renewals') expansionOpps = []
    else if (recordType === 'expansions') renewalOpps = []

    if (activeTypes.length > 0) {
      renewalOpps   = renewalOpps.filter(o => activeTypes.includes(o.Type ?? ''))
      expansionOpps = expansionOpps.filter(o => activeTypes.includes(o.Type ?? ''))
    }
  }

  // RevOps-specific filters (stage multi-select, pricebook, auto-renewal direction)
  if (isRevOpsView) {
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

  // Date range filter: all views
  if (resolvedFrom) {
    renewalOpps   = renewalOpps.filter(o => o.CloseDate >= resolvedFrom!)
    expansionOpps = expansionOpps.filter(o => o.CloseDate >= resolvedFrom!)
  }
  if (resolvedTo) {
    renewalOpps   = renewalOpps.filter(o => o.CloseDate <= resolvedTo!)
    expansionOpps = expansionOpps.filter(o => o.CloseDate <= resolvedTo!)
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
      />
    </div>
  )
}
