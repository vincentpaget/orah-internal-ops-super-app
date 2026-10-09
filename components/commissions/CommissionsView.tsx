'use client'

import type { CompPlan, DealEdit, DealEditFieldValue, SFCommissionOpportunity, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { buildQuarterGroups } from '@/lib/commissions/calc'
import QuarterDealsPanel from './QuarterDealsPanel'

interface Props {
  deals: SFCommissionOpportunity[]
  settingsByQuarter: Record<string, CompPlan>
  edits: Record<string, DealEdit>
  syncedEdits: Record<string, DealEdit>
  onEditField: (dealId: string, field: keyof DealEdit, value: DealEditFieldValue) => void
  onUndoEdits: (dealId: string) => void
  syncStatus: Record<string, SyncStatus>
  onSync: SyncDealFn
  canEdit: boolean
}

export default function CommissionsView({
  deals, settingsByQuarter, edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit,
}: Props) {
  if (deals.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>No Closed Won deals for this rep.</p>
  }

  const groups = buildQuarterGroups(deals, settingsByQuarter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {groups.map((group, i) => (
        <div
          key={group.quarterKey}
          style={i === 0 ? undefined : { marginTop: 40, paddingTop: 32, borderTop: '4px solid var(--navy-900)' }}
        >
        <QuarterDealsPanel
          group={group}
          edits={edits}
          syncedEdits={syncedEdits}
          onEditField={onEditField}
          onUndoEdits={onUndoEdits}
          syncStatus={syncStatus}
          onSync={onSync}
          canEdit={canEdit}
        />
        </div>
      ))}
    </div>
  )
}
