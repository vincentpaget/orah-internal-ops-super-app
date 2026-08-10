import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { getCommissionsPermissions } from '@/lib/commissions/permissions'
import { fetchActiveSalesforceUsers, fetchClosedWonOwners, fetchCommissionOpportunitiesForOwner, fetchPayableOpportunities, fetchPendingOpportunities } from '@/lib/commissions/salesforce'
import { defaultTrailingQuarterKeys, listQuarterOptions, quarterDateRange, quarterKeyForDate } from '@/lib/commissions/quarters'
import { fetchCompPlanSettings, fetchSettingsConfig } from '@/lib/commissions/compPlanStore'
import { DEFAULT_SETTINGS_QUARTERS, DEFAULT_SETTINGS_REPS } from '@/lib/commissions/settingsConfig'
import type { CompPlanSettings, SFCommissionOpportunity } from '@/lib/commissions/types'
import CommissionsClient from '@/components/commissions/CommissionsClient'

interface Props {
  searchParams: Promise<{ owner?: string; quarters?: string }>
}

export default async function CommissionsPage({ searchParams }: Props) {
  const { owner: ownerParam, quarters: quartersParam } = await searchParams

  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  const permissions = getCommissionsPermissions(session)

  const quarterOptions = listQuarterOptions()
  const validQuarterKeys = new Set(quarterOptions.map(q => q.value))

  const selectedQuarters = quartersParam !== undefined
    ? quartersParam.split(',').filter(k => validQuarterKeys.has(k))
    : defaultTrailingQuarterKeys()

  let sfError: string | null = null
  let owners: { ownerId: string; ownerName: string }[] = []
  let deals: SFCommissionOpportunity[] = []
  let payableDeals: SFCommissionOpportunity[] = []
  let pendingDeals: SFCommissionOpportunity[] = []

  const sfConfigured = Boolean(process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN)

  if (sfConfigured) {
    if (permissions.isAdmin) {
      try {
        owners = await fetchClosedWonOwners()
      } catch (err) {
        sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
      }
    } else if (permissions.ownerId) {
      owners = [{ ownerId: permissions.ownerId, ownerName: permissions.ownerName ?? 'Me' }]
    }
  }

  // Non-admins are locked to their own Salesforce User Id, regardless of any `owner` query param —
  // this is the actual security boundary, not just hiding the picker in the UI.
  const selectedOwner = permissions.isAdmin
    ? (ownerParam && owners.some(o => o.ownerId === ownerParam) ? ownerParam : null)
    : permissions.ownerId

  if (sfConfigured && selectedOwner && !sfError && selectedQuarters.length > 0) {
    try {
      const ranges = selectedQuarters.map(quarterDateRange)
      const start = ranges.map(r => r.start).sort()[0]
      const end = ranges.map(r => r.end).sort().at(-1)!
      const dealsInRange = await fetchCommissionOpportunitiesForOwner(selectedOwner, start, end)
      const quarterSet = new Set(selectedQuarters)
      deals = dealsInRange.filter(d => quarterSet.has(quarterKeyForDate(d.CloseDate)))
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  const scopedOwnerId = permissions.isAdmin ? undefined : (permissions.ownerId ?? undefined)

  if (sfConfigured && !sfError) {
    try {
      payableDeals = await fetchPayableOpportunities(scopedOwnerId)
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  if (sfConfigured && !sfError) {
    try {
      pendingDeals = await fetchPendingOpportunities(scopedOwnerId)
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  let settingsError: string | null = null
  let initialSettings: CompPlanSettings = {}
  let settingsReps: string[] = DEFAULT_SETTINGS_REPS
  let settingsQuarters: string[] = DEFAULT_SETTINGS_QUARTERS
  try {
    const [settings, config] = await Promise.all([fetchCompPlanSettings(), fetchSettingsConfig()])
    initialSettings = settings
    settingsReps = config.reps
    settingsQuarters = config.quarters
  } catch (err) {
    settingsError = err instanceof Error ? err.message : 'Unknown error loading comp plans'
  }

  let activeUsers: { id: string; name: string }[] = []
  if (sfConfigured && !sfError && permissions.isAdmin) {
    try {
      activeUsers = await fetchActiveSalesforceUsers()
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>
          Commissions
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-2)', marginTop: 6 }}>
          Closed Won deals for a rep, broken out by quarter, with quota-attainment commission calculated per quarter.
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
          <strong>Salesforce connection error:</strong> {sfError}
        </div>
      )}

      {settingsError && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'var(--red-50)',
          border: '1px solid rgba(201,17,31,0.2)',
          color: 'var(--red-700)',
          fontSize: 13,
        }}>
          <strong>Comp plan storage error:</strong> {settingsError} — comp plan edits won&apos;t be saved until this is fixed.
        </div>
      )}

      <CommissionsClient
        deals={deals}
        selectedOwner={selectedOwner}
        owners={owners}
        selectedQuarters={selectedQuarters}
        quarterOptions={quarterOptions}
        payableDeals={payableDeals}
        pendingDeals={pendingDeals}
        initialSettings={initialSettings}
        initialSettingsReps={settingsReps}
        initialSettingsQuarters={settingsQuarters}
        activeUsers={activeUsers}
        isAdmin={permissions.isAdmin}
      />
    </div>
  )
}
