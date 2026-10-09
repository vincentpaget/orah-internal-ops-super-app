'use client'

import { useState } from 'react'
import type { CommissionBand, DealEdit, DealEditFieldValue, QuarterCommissionGroup, SyncDealFn, SyncStatus } from '@/lib/commissions/types'
import { DEAL_VIEWS } from '@/lib/commissions/views'
import { nzd } from '@/lib/formatters'
import { isNewBusiness } from '@/lib/commissions/calc'
import CommissionsTable, { type DealSection } from './CommissionsTable'

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

const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }

function QuarterHeading({ label }: { label: string }) {
  return (
    <h2 style={{
      fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', margin: 0,
      paddingLeft: 10, borderLeft: '4px solid var(--navy-900)', lineHeight: 1.2,
    }}>
      {label}
    </h2>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      marginLeft: 8, marginRight: 2, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: 'rgba(0,0,0,0.54)',
    }}>
      {children}
    </span>
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
  const tableProps = { edits, syncedEdits, onEditField, onUndoEdits, syncStatus, onSync, canEdit }

  if (!group.hasPlan) {
    return (
      <div>
        <QuarterHeading label={group.quarterLabel} />
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '6px 0 0', fontStyle: 'italic' }}>
          No comp plan set for this quarter — commissions aren&apos;t calculated. Set one in the Settings tab to see calculations here.
        </p>
      </div>
    )
  }

  const expansionRatePct = group.expansionRate != null ? `${Math.round(group.expansionRate * 10000) / 100}%` : null
  const sections: DealSection[] | undefined = expansionRatePct != null
    ? [
        { key: 'new_business', title: 'New Business Deals', deals: filteredDeals.filter(isNewBusiness) },
        { key: 'expansion', title: 'Expansion Deals', deals: filteredDeals.filter(d => !isNewBusiness(d)) },
      ]
    : undefined

  return (
    <div>
      <QuarterHeading label={group.quarterLabel} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        margin: '14px 0 12px',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        <div style={ROW}>
          <GroupLabel>{expansionRatePct != null ? 'New Business bands' : 'Commission bands'}</GroupLabel>
          <BandPill range="Quota" rate={nzd(group.quota)} />
          {group.bands.map((band, i) => (
            <BandPill
              key={band.key}
              range={bandDollarRange(group.quota, group.bands, i)}
              rate={`${Math.round(band.rate * 10000) / 100}%`}
            />
          ))}
          <GroupLabel>Expansion</GroupLabel>
          <BandPill range={expansionRatePct != null ? 'Flat' : 'In bands'} rate={expansionRatePct ?? ''} />
        </div>
      </div>

      <CommissionsTable
        deals={filteredDeals}
        sections={sections}
        columns={view.columns}
        showBandLines={view.key === 'all'}
        {...tableProps}
      />
    </div>
  )
}
