'use client'

import { useState } from 'react'
import type { CommissionBand, DealEdit, DealEditFieldValue, QuarterCommissionGroup, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { DEAL_VIEWS } from '@/lib/commissions/views'
import { nzd, percent } from '@/lib/formatters'
import CommissionsTable from './CommissionsTable'

function bandDollarRange(quota: number, bands: CommissionBand[], index: number): string {
  const prevMax = index === 0 ? 0 : bands[index - 1].max
  const lower = quota * (prevMax ?? 0)
  const band = bands[index]
  const lowerStr = Math.round(lower).toLocaleString('en-US')
  if (band.max == null) return `$${lowerStr}+`
  const upperStr = Math.round(quota * band.max).toLocaleString('en-US')
  return `$${lowerStr}–${upperStr}`
}

const PILL: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  borderRadius: 6,
  background: '#FAFAFA',
  fontSize: 12,
  color: 'rgba(0,0,0,0.54)',
  whiteSpace: 'nowrap',
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={PILL}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: '#262626' }}>{value}</span>
    </div>
  )
}

function BandPill({ range, rate }: { range: string; rate: string }) {
  return (
    <div style={PILL}>
      <span>{range}</span>
      <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.66)' }}>{rate}</span>
    </div>
  )
}

interface Props {
  group: QuarterCommissionGroup
  edits: Record<string, DealEdit>
  syncedEdits: Record<string, DealEdit>
  onEditField: (dealId: string, field: keyof DealEdit, value: DealEditFieldValue) => void
  onUndoEdits: (dealId: string) => void
  syncStatus: Record<string, SyncStatus>
  onSync: SyncDealFn
  canEdit: boolean
}

const TAB: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--fg-2)',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export default function QuarterDealsPanel({ group, edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit }: Props) {
  const [viewKey, setViewKey] = useState(DEAL_VIEWS[0].key)
  const view = DEAL_VIEWS.find(v => v.key === viewKey) ?? DEAL_VIEWS[0]
  const filteredDeals = group.deals.filter(view.filter)

  if (!group.hasPlan) {
    return (
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{group.quarterLabel}</h2>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '6px 0 0', fontStyle: 'italic' }}>
          No comp plan set for this quarter — commissions aren&apos;t calculated. Set one in the Settings tab to see calculations here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{group.quarterLabel}</h2>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
          marginTop: 8, padding: '0 0 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <StatPill label="Quota" value={nzd(group.quota)} />
            <StatPill label="Won" value={nzd(group.totalAmount)} />
            <StatPill label="Attainment" value={percent(group.finalAttainment)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.54)', marginRight: 2 }}>
              Commission bands
            </span>
            {group.bands.map((band, i) => (
              <BandPill
                key={band.key}
                range={bandDollarRange(group.quota, group.bands, i)}
                rate={`${Math.round(band.rate * 10000) / 100}%`}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {DEAL_VIEWS.map(v => {
          const count = group.deals.filter(v.filter).length
          const active = v.key === viewKey
          return (
            <button
              key={v.key}
              onClick={() => setViewKey(v.key)}
              style={{
                ...TAB,
                background: active ? 'var(--blue-50)' : 'var(--bg)',
                color: active ? 'var(--navy-900)' : 'var(--fg-2)',
                borderColor: active ? 'var(--navy-900)' : 'var(--border)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {v.label} ({count})
            </button>
          )
        })}
      </div>

      <CommissionsTable
        deals={filteredDeals}
        columns={view.columns}
        showBandLines={view.key === 'all'}
        edits={edits}
        syncedEdits={syncedEdits}
        onEditField={onEditField}
        onUndoEdits={onUndoEdits}
        syncStatus={syncStatus}
        onSync={onSync}
        canEdit={canEdit}
      />
    </div>
  )
}
