'use client'

import { useEffect, useState } from 'react'
import type { CommissionBand } from '@/lib/commissions/types'
import { marginalCommission } from '@/lib/commissions/calc'
import { nzd } from '@/lib/formatters'

interface Props {
  groupId: string
  quota: number
  bands: CommissionBand[]
  isEditing: boolean
  onToggleEditing: (groupId: string) => void
  onQuotaChange: (groupId: string, quota: number) => void
  onBandsChange: (groupId: string, bands: CommissionBand[]) => void
  onRemove: (groupId: string) => void
}

interface BandDraft {
  maxPct: number | null // null = unbounded (top band)
  ratePct: number
}

function toDrafts(bands: CommissionBand[]): BandDraft[] {
  return bands.map(b => ({
    maxPct: b.max == null ? null : Math.round(b.max * 1000) / 10,
    ratePct: Math.round(b.rate * 10000) / 100,
  }))
}

function fromDrafts(drafts: BandDraft[]): CommissionBand[] {
  return drafts.map((d, i) => ({
    key: String(i + 1),
    name: String(i + 1),
    emoji: '',
    max: d.maxPct == null ? null : d.maxPct / 100,
    rate: d.ratePct / 100,
  }))
}

function quotaRangeLabel(quota: number, lowerPct: number, upperPct: number | null): string {
  const lower = nzd((lowerPct / 100) * quota)
  if (upperPct == null) return `${lower}+`
  return `${lower} – ${nzd((upperPct / 100) * quota)}`
}

const INPUT: React.CSSProperties = {
  height: 26,
  padding: '0 6px',
  borderRadius: 5,
  border: '1px solid var(--border-strong)',
  background: 'var(--bg)',
  color: 'var(--fg-1)',
  fontSize: 12,
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
}

const TH: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  textAlign: 'left',
}

const TD: React.CSSProperties = { padding: '3px 6px' }

function EditToggleButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={editing ? 'Save' : 'Edit'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: 'pointer',
        border: `1px solid ${editing ? 'var(--blue-500)' : 'var(--border)'}`,
        background: editing ? 'var(--blue-50)' : 'var(--bg)',
        color: editing ? 'var(--blue-500)' : 'var(--fg-2)',
      }}
    >
      {editing ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M11 2.3l2.7 2.7-8 8-3.2.8.8-3.2 8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Remove this comp plan for this period"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, padding: 0, cursor: 'pointer',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--fg-2)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5l.6 8.5a1 1 0 001 1h3.8a1 1 0 001-1l.6-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

export default function CompPlanTile({ groupId, quota, bands, isEditing, onToggleEditing, onQuotaChange, onBandsChange, onRemove }: Props) {
  const drafts = toDrafts(bands)
  const [rawEdits, setRawEdits] = useState<Record<string, string>>({})

  // Drop any in-progress blank/invalid text once the tile locks back to view mode,
  // so a half-typed field doesn't linger and confuse the next edit session.
  useEffect(() => {
    if (!isEditing) setRawEdits({})
  }, [isEditing])

  function displayValue(key: string, committed: number): string {
    return rawEdits[key] !== undefined ? rawEdits[key] : String(committed)
  }

  /**
   * Keeps whatever the user typed (including blank) visible immediately, but only commits
   * a real number — an empty/invalid field otherwise silently coerces to 0 on every keystroke,
   * which is especially bad for the uncapped top band's rate (it briefly/permanently zeroes
   * commission for everything above the last threshold while someone is just retyping a number).
   */
  function handleNumberInput(key: string, raw: string, commit: (value: number) => void) {
    setRawEdits(prev => ({ ...prev, [key]: raw }))
    if (raw.trim() === '') return
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    commit(parsed)
    setRawEdits(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function updateBand(index: number, field: 'maxPct' | 'ratePct', value: number) {
    const next = drafts.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    onBandsChange(groupId, fromDrafts(next))
  }

  function addBand() {
    let next: BandDraft[]
    if (drafts.length === 0) {
      next = [{ maxPct: null, ratePct: 0 }]
    } else {
      const last = drafts[drafts.length - 1]
      const secondLastMax = drafts.length >= 2 ? drafts[drafts.length - 2].maxPct : null
      const newThresholdForOldLast = last.maxPct ?? (secondLastMax != null ? secondLastMax + 25 : 100)
      const updatedLast = { ...last, maxPct: newThresholdForOldLast }
      next = [...drafts.slice(0, -1), updatedLast, { maxPct: null, ratePct: last.ratePct }]
    }
    setRawEdits({})
    onBandsChange(groupId, fromDrafts(next))
  }

  function removeBand(index: number) {
    if (drafts.length <= 1) return
    const filtered = drafts.filter((_, i) => i !== index)
    const next = filtered.map((d, i) => (i === filtered.length - 1 ? { ...d, maxPct: null } : d))
    setRawEdits({})
    onBandsChange(groupId, fromDrafts(next))
  }

  const commissionAt100 = quota > 0 ? marginalCommission(0, quota, quota, bands).commission : 0
  const commissionAt120 = quota > 0 ? marginalCommission(0, quota * 1.2, quota, bands).commission : 0

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 14,
      minWidth: 320,
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Quota</span>
          {isEditing ? (
            <input
              type="number"
              step={1000}
              value={displayValue('quota', quota)}
              onChange={e => handleNumberInput('quota', e.target.value, value => onQuotaChange(groupId, value))}
              style={{ ...INPUT, width: 110, fontWeight: 700 }}
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>{nzd(quota)}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <RemoveButton onClick={() => onRemove(groupId)} />
          <EditToggleButton editing={isEditing} onClick={() => onToggleEditing(groupId)} />
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={TH}>#</th>
            <th style={TH}>Up to</th>
            <th style={TH}>Range</th>
            <th style={TH}>Rate</th>
            {isEditing && <th style={TH} />}
          </tr>
        </thead>
        <tbody>
          {drafts.map((band, i) => (
            <tr key={i}>
              <td style={TD}>{i + 1}</td>
              <td style={TD}>
                {band.maxPct == null ? (
                  <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>—</span>
                ) : isEditing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <input
                      type="number"
                      value={displayValue(`${i}-maxPct`, band.maxPct)}
                      onChange={e => handleNumberInput(`${i}-maxPct`, e.target.value, value => updateBand(i, 'maxPct', value))}
                      style={{ ...INPUT, width: 52 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>%</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{band.maxPct}%</span>
                )}
              </td>
              <td style={TD}>
                <span style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>
                  {quotaRangeLabel(quota, i === 0 ? 0 : drafts[i - 1].maxPct ?? 0, band.maxPct)}
                </span>
              </td>
              <td style={TD}>
                {isEditing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <input
                      type="number"
                      step="0.01"
                      value={displayValue(`${i}-ratePct`, band.ratePct)}
                      onChange={e => handleNumberInput(`${i}-ratePct`, e.target.value, value => updateBand(i, 'ratePct', value))}
                      style={{ ...INPUT, width: 60 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>%</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{band.ratePct}%</span>
                )}
              </td>
              {isEditing && (
                <td style={TD}>
                  <button
                    onClick={() => removeBand(i)}
                    disabled={drafts.length <= 1}
                    title="Remove band"
                    style={{
                      border: 'none', background: 'transparent', cursor: drafts.length <= 1 ? 'not-allowed' : 'pointer',
                      color: drafts.length <= 1 ? 'var(--fg-3)' : 'var(--red-500)', fontSize: 13, padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isEditing && (
        <button
          onClick={addBand}
          style={{
            marginTop: 8, height: 24, padding: '0 8px', borderRadius: 5,
            border: '1px solid var(--border-strong)', background: 'var(--bg)',
            color: 'var(--fg-2)', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          + Add band
        </button>
      )}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
          Expected Commission
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: 'var(--fg-2)' }}>At 100% attainment</span>
          <span style={{ fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>{nzd(commissionAt100)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--fg-2)' }}>At 120% attainment</span>
          <span style={{ fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>{nzd(commissionAt120)}</span>
        </div>
      </div>
    </div>
  )
}
