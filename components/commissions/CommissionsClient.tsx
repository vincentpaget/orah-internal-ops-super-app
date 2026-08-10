'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CommissionBand, CompPlanSettings, DealEdit, DealEditFieldValue, SFCommissionOpportunity, StoredCompPlan, SyncStatus } from '@/lib/commissions/types'
import { DEFAULT_BANDS, DEFAULT_QUOTA } from '@/lib/commissions/calc'
import CommissionsFilters from './CommissionsFilters'
import CommissionsView from './CommissionsView'
import SettingsView from './SettingsView'
import PayableSummaryView from './PayableSummaryView'
import PendingSummaryView from './PendingSummaryView'

interface Props {
  deals: SFCommissionOpportunity[]
  selectedOwner: string | null
  owners: { ownerId: string; ownerName: string }[]
  selectedQuarters: string[]
  quarterOptions: { value: string; label: string }[]
  payableDeals: SFCommissionOpportunity[]
  pendingDeals: SFCommissionOpportunity[]
  initialSettings: CompPlanSettings
  initialSettingsReps: string[]
  initialSettingsQuarters: string[]
  activeUsers: { id: string; name: string }[]
  isAdmin: boolean
}

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 24,
}

type TabKey = 'summary' | 'payable' | 'pending' | 'settings'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary', label: 'Rep Summary' },
  { key: 'payable', label: 'Payable Summary' },
  { key: 'pending', label: 'Pending Summary' },
  { key: 'settings', label: 'Settings' },
]

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--navy-900)' : 'var(--border)'}`,
        background: active ? 'var(--blue-50)' : 'var(--bg)',
        color: active ? 'var(--navy-900)' : 'var(--fg-2)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function RefreshButton({ syncing, onClick }: { syncing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={syncing}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 34,
        padding: '0 16px',
        borderRadius: 6,
        border: '1px solid var(--border-strong)',
        background: syncing ? 'var(--bg-subtle)' : 'var(--bg)',
        color: syncing ? 'var(--fg-3)' : 'var(--fg-2)',
        fontSize: 13,
        fontWeight: 500,
        cursor: syncing ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'color 150ms, background 150ms',
      }}
    >
      <svg
        width="14" height="14" viewBox="0 0 16 16" fill="none"
        style={{ animation: syncing ? 'sf-spin 0.8s linear infinite' : 'none' }}
      >
        <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 2.5l2.3 1.8-1.8 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {syncing ? 'Refreshing…' : 'Refresh from Salesforce'}
    </button>
  )
}

export default function CommissionsClient({ deals, selectedOwner, owners, selectedQuarters, quarterOptions, payableDeals, pendingDeals, initialSettings, initialSettingsReps, initialSettingsQuarters, activeUsers, isAdmin }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [refreshing, setRefreshing] = useState(false)
  const [edits, setEdits] = useState<Record<string, DealEdit>>({})
  const [syncedEdits, setSyncedEdits] = useState<Record<string, DealEdit>>({})
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({})
  const [settings, setSettings] = useState<CompPlanSettings>(initialSettings)
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null)

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 2000)
  }

  function setEditField(dealId: string, field: keyof DealEdit, value: DealEditFieldValue) {
    setEdits(prev => ({ ...prev, [dealId]: { ...prev[dealId], [field]: value } }))
  }

  function undoEdits(dealId: string) {
    setEdits(prev => {
      if (!(dealId in prev)) return prev
      const next = { ...prev }
      delete next[dealId]
      return next
    })
  }

  async function syncDeal(
    dealId: string,
    commissionAmountNZD: number | null,
    commissionNotes: string | null,
    commissionPaid: boolean | null,
    commissionPaidAmountNZD: number | null,
    commissionPaidDate: string | null
  ) {
    setSyncStatus(prev => ({ ...prev, [dealId]: 'syncing' }))
    try {
      const res = await fetch('/api/commissions/update-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, commissionAmountNZD, commissionNotes, commissionPaid, commissionPaidAmountNZD, commissionPaidDate }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Sync failed')
      }
      setSyncedEdits(prev => ({
        ...prev,
        [dealId]: {
          commissionAmount: commissionAmountNZD,
          commissionNotes,
          commissionPaid,
          commissionPaidAmount: commissionPaidAmountNZD,
          commissionPaidDate,
        },
      }))
      setSyncStatus(prev => ({ ...prev, [dealId]: 'success' }))
    } catch {
      setSyncStatus(prev => ({ ...prev, [dealId]: 'error' }))
    } finally {
      setTimeout(() => {
        setSyncStatus(prev => {
          const next = { ...prev }
          delete next[dealId]
          return next
        })
      }, 2500)
    }
  }

  async function persistCell(cellId: string, value: StoredCompPlan) {
    try {
      const res = await fetch('/api/commissions/comp-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellId, value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (HTTP ${res.status})`)
      }
      setSettingsSaveError(null)
    } catch (err) {
      setSettingsSaveError(err instanceof Error ? err.message : 'Failed to save comp plan')
    }
  }

  function setQuota(cellId: string, quota: number) {
    const existing = settings[cellId]
    const bands = existing && existing !== 'empty' ? existing.bands : DEFAULT_BANDS
    const next: StoredCompPlan = { quota, bands }
    setSettings(prev => ({ ...prev, [cellId]: next }))
    persistCell(cellId, next)
  }

  function setBands(cellId: string, bands: CommissionBand[]) {
    const existing = settings[cellId]
    const quota = existing && existing !== 'empty' ? existing.quota : DEFAULT_QUOTA
    const next: StoredCompPlan = { quota, bands }
    setSettings(prev => ({ ...prev, [cellId]: next }))
    persistCell(cellId, next)
  }

  function removeCell(cellId: string) {
    if (!window.confirm('Remove this comp plan for this period? The cell will show as empty until a plan is added again.')) return
    setSettings(prev => ({ ...prev, [cellId]: 'empty' }))
    persistCell(cellId, 'empty')
  }

  function addCell(cellId: string) {
    const next: StoredCompPlan = { quota: DEFAULT_QUOTA, bands: DEFAULT_BANDS }
    setSettings(prev => ({ ...prev, [cellId]: next }))
    persistCell(cellId, next)
  }

  const selectedOwnerName = owners.find(o => o.ownerId === selectedOwner)?.ownerName ?? null
  const settingsByQuarterForSelectedOwner: Record<string, { quota: number; bands: CommissionBand[] }> = {}
  if (selectedOwnerName) {
    const prefix = `${selectedOwnerName}::`
    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith(prefix) || value === 'empty') continue
      settingsByQuarterForSelectedOwner[key.slice(prefix.length)] = value
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {TABS.filter(tab => tab.key !== 'settings' || isAdmin).map(tab => (
          <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </TabButton>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <RefreshButton syncing={refreshing} onClick={handleRefresh} />
        </div>
      </div>

      {!isAdmin && (
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 16px', fontStyle: 'italic' }}>
          Read-only — showing your own deals only.
        </p>
      )}

      {settingsSaveError && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'var(--red-50)',
          border: '1px solid rgba(201,17,31,0.2)',
          color: 'var(--red-700)',
          fontSize: 13,
        }}>
          <strong>Comp plan save failed:</strong> {settingsSaveError} — your last change is only kept locally until this is resolved.
        </div>
      )}

      {activeTab === 'summary' && (
        <>
          <CommissionsFilters
            selectedOwner={selectedOwner}
            owners={owners}
            selectedQuarters={selectedQuarters}
            quarterOptions={quarterOptions}
          />
          <section style={CARD}>
            {selectedOwner == null ? (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>Select a rep to view their deals by quarter.</p>
            ) : selectedQuarters.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic' }}>Select at least one quarter to view deals.</p>
            ) : (
              <CommissionsView
                deals={deals}
                settingsByQuarter={settingsByQuarterForSelectedOwner}
                edits={edits}
                syncedEdits={syncedEdits}
                onEditField={setEditField}
                onUndoEdits={undoEdits}
                syncStatus={syncStatus}
                onSync={syncDeal}
                canEdit={isAdmin}
              />
            )}
          </section>
        </>
      )}

      {activeTab === 'payable' && (
        <section style={CARD}>
          <PayableSummaryView
            deals={payableDeals}
            edits={edits}
            syncedEdits={syncedEdits}
            onEditField={setEditField}
            onUndoEdits={undoEdits}
            syncStatus={syncStatus}
            onSync={syncDeal}
            canEdit={isAdmin}
          />
        </section>
      )}

      {activeTab === 'pending' && (
        <section style={CARD}>
          <PendingSummaryView
            deals={pendingDeals}
            edits={edits}
            syncedEdits={syncedEdits}
            onEditField={setEditField}
            onUndoEdits={undoEdits}
            syncStatus={syncStatus}
            onSync={syncDeal}
            canEdit={isAdmin}
          />
        </section>
      )}

      {activeTab === 'settings' && (
        <section style={CARD}>
          <SettingsView
            settings={settings}
            onSetQuota={setQuota}
            onSetBands={setBands}
            onRemoveCell={removeCell}
            onAddCell={addCell}
            initialReps={initialSettingsReps}
            initialQuarters={initialSettingsQuarters}
            activeUsers={activeUsers}
          />
        </section>
      )}
    </div>
  )
}
