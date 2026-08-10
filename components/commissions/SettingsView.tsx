'use client'

import { useEffect, useState } from 'react'
import type { CommissionBand, CompPlanSettings } from '@/lib/commissions/types'
import { currentQuarterKey, nextQuarterKey, quarterLabel } from '@/lib/commissions/quarters'
import CompPlanTile from './CompPlanTile'

const SELECT_STYLE: React.CSSProperties = {
  height: 32,
  padding: '0 26px 0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--fg-1)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%23667085' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  minWidth: 200,
}

const ADD_QUARTER_BUTTON: React.CSSProperties = {
  height: 28, padding: '0 10px', borderRadius: 5,
  border: '1px solid var(--border-strong)', background: 'var(--bg)',
  color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
  textTransform: 'none', letterSpacing: 'normal', fontWeight: 500,
}

const TH: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
}

const STICKY_REP_COLUMN: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--bg)',
  zIndex: 1,
  boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)',
}

function cellKey(repName: string, quarterKey: string): string {
  return `${repName}::${quarterKey}`
}

function RemoveTextButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 4, padding: 0, cursor: 'pointer',
        border: 'none', background: 'transparent', color: 'var(--fg-3)', fontSize: 13, flexShrink: 0,
      }}
    >
      ✕
    </button>
  )
}

function EmptyPlanCell({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      minWidth: 320,
      minHeight: 96,
      border: '1px dashed var(--border-strong)',
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 14,
    }}>
      <span style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>No plan for this period</span>
      <button
        onClick={onAdd}
        style={{
          height: 26, padding: '0 12px', borderRadius: 5,
          border: '1px solid var(--border-strong)', background: 'var(--bg)',
          color: 'var(--fg-2)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        + Add plan
      </button>
    </div>
  )
}

interface Props {
  settings: CompPlanSettings
  onSetQuota: (cellId: string, quota: number) => void
  onSetBands: (cellId: string, bands: CommissionBand[]) => void
  onRemoveCell: (cellId: string) => void
  onAddCell: (cellId: string) => void
  initialReps: string[]
  initialQuarters: string[]
  activeUsers: { id: string; name: string }[]
}

export default function SettingsView({
  settings, onSetQuota, onSetBands, onRemoveCell, onAddCell,
  initialReps, initialQuarters, activeUsers,
}: Props) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [reps, setReps] = useState<string[]>(initialReps)
  const [quarters, setQuarters] = useState<string[]>(initialQuarters)
  const [configError, setConfigError] = useState<string | null>(null)
  const [newRep, setNewRep] = useState('')

  useEffect(() => setReps(initialReps), [initialReps])
  useEffect(() => setQuarters(initialQuarters), [initialQuarters])

  async function persistConfig(next: { reps?: string[]; quarters?: string[] }) {
    try {
      const res = await fetch('/api/commissions/settings-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (HTTP ${res.status})`)
      }
      setConfigError(null)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  function addRep(name: string) {
    if (!name || reps.includes(name)) return
    const next = [...reps, name]
    setReps(next)
    persistConfig({ reps: next })
    setNewRep('')
  }

  function removeRep(name: string) {
    if (!window.confirm(`Remove ${name} from the settings table?`)) return
    const next = reps.filter(r => r !== name)
    setReps(next)
    persistConfig({ reps: next })
  }

  function addNextQuarter() {
    const next = [...quarters, upcomingQuarter]
    setQuarters(next)
    persistConfig({ quarters: next })
  }

  function removeQuarter(quarterKey: string) {
    if (!window.confirm(`Remove ${quarterLabel(quarterKey)} from the settings table?`)) return
    const next = quarters.filter(q => q !== quarterKey)
    setQuarters(next)
    persistConfig({ quarters: next })
  }

  function toggleEditing(cellId: string) {
    setEditingIds(prev => {
      const next = new Set(prev)
      if (next.has(cellId)) next.delete(cellId)
      else next.add(cellId)
      return next
    })
  }

  function handleRemoveCell(cellId: string) {
    onRemoveCell(cellId)
    setEditingIds(prev => {
      if (!prev.has(cellId)) return prev
      const next = new Set(prev)
      next.delete(cellId)
      return next
    })
  }

  function handleAddCell(cellId: string) {
    onAddCell(cellId)
    setEditingIds(prev => new Set(prev).add(cellId))
  }

  function hasPlan(value: CompPlanSettings[string] | undefined): boolean {
    return value != null && value !== 'empty'
  }

  const sortedQuarters = [...quarters].sort((a, b) => a.localeCompare(b))
  const availableUsers = activeUsers.filter(u => !reps.includes(u.name))
  const upcomingQuarter = sortedQuarters.length > 0
    ? nextQuarterKey(sortedQuarters[sortedQuarters.length - 1])
    : currentQuarterKey()
  const columnCount = sortedQuarters.length + 1

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 16px' }}>
        Shared across everyone — comp plans set here feed directly into Rep Summary&apos;s quota-attainment calculations.
      </p>

      {configError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'var(--red-50)', border: '1px solid rgba(201,17,31,0.2)',
          color: 'var(--red-700)', fontSize: 13,
        }}>
          <strong>Save failed:</strong> {configError}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: 'auto', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ ...TH, ...STICKY_REP_COLUMN }}>Rep</th>
              {sortedQuarters.map(q => {
                const removable = !reps.some(name => hasPlan(settings[cellKey(name, q)]))
                return (
                  <th key={q} style={TH}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {quarterLabel(q)}
                      {removable && <RemoveTextButton onClick={() => removeQuarter(q)} title={`Remove ${quarterLabel(q)}`} />}
                    </span>
                  </th>
                )
              })}
              <th style={TH}>
                <button onClick={addNextQuarter} style={ADD_QUARTER_BUTTON}>+ Add {quarterLabel(upcomingQuarter)}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {reps.map(name => {
              const removable = !sortedQuarters.some(q => hasPlan(settings[cellKey(name, q)]))
              return (
                <tr key={name}>
                  <td style={{ ...TD, ...STICKY_REP_COLUMN, fontWeight: 600, color: 'var(--fg-1)', fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {name}
                      {removable && <RemoveTextButton onClick={() => removeRep(name)} title={`Remove ${name}`} />}
                    </span>
                  </td>
                  {sortedQuarters.map(q => {
                    const id = cellKey(name, q)
                    const stored = settings[id]
                    return (
                      <td key={q} style={TD}>
                        {stored == null || stored === 'empty' ? (
                          <EmptyPlanCell onAdd={() => handleAddCell(id)} />
                        ) : (
                          <CompPlanTile
                            groupId={id}
                            quota={stored.quota}
                            bands={stored.bands}
                            isEditing={editingIds.has(id)}
                            onToggleEditing={toggleEditing}
                            onQuotaChange={onSetQuota}
                            onBandsChange={onSetBands}
                            onRemove={handleRemoveCell}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td style={TD} />
                </tr>
              )
            })}
            <tr>
              <td style={{ ...TD, ...STICKY_REP_COLUMN, borderBottom: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-2)' }}>
                  Add new rep
                  <select
                    value={newRep}
                    onChange={e => addRep(e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <option value="">Select…</option>
                    {availableUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </span>
              </td>
              <td style={{ ...TD, borderBottom: 'none' }} colSpan={columnCount} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
