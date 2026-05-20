'use client'

import { useState } from 'react'
import type { ClusterObj, RecordObj } from '@/lib/dedupe'

const SF_BASE = 'https://orah.lightning.force.com'
const HS_PORTAL = '20549138'

interface MasterUpdate { name?: string; website?: string; ownerId?: string }

interface Props {
  cluster: ClusterObj
  masterId: string
  masterUpdate: MasterUpdate
  ownerMap: Record<string, string>
  mergeState?: 'running' | 'done' | 'error'
  mergeError?: string
  isIgnored: boolean
  isSelected: boolean
  onMerge: (clusterId: string) => void
  onIgnore: (clusterId: string) => void
  onUnignore: (clusterId: string) => void
  onSelect: (clusterId: string, checked: boolean) => void
  onApplyOverride: (clusterId: string, newMasterId: string) => void
  onRemoveRecord: (clusterId: string, recordId: string) => void
  onMasterUpdate: (clusterId: string, field: 'name' | 'website' | 'ownerId', value: string) => void
}

function conflictDescription(cluster: ClusterObj, masterId: string): string {
  const withDeals = Object.values(cluster.records).filter(r => r.sfId && r.deals > 0)
  const names = withDeals.map(r => `"${r.name || r.id}"${r.id === masterId ? ' (current master)' : ''}`).join(' and ')
  return `${withDeals.length} records have Salesforce IDs with active deals: ${names}`
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function RecordRow({
  r, isMaster, isIgnored, isMerged, clusterId, masterUpdate, ownerMap,
  onApplyOverride, onRemoveRecord, onMasterUpdate,
}: {
  r: RecordObj; isMaster: boolean; isIgnored: boolean; isMerged: boolean
  clusterId: string; masterUpdate: MasterUpdate; ownerMap: Record<string, string>
  onApplyOverride: (cid: string, rid: string) => void
  onRemoveRecord: (cid: string, rid: string) => void
  onMasterUpdate: (cid: string, field: 'name' | 'website' | 'ownerId', value: string) => void
}) {
  const [editing, setEditing] = useState(false)

  const hsUrl = `https://app.hubspot.com/contacts/${HS_PORTAL}/company/${r.id}`
  const sfUrl = r.sfId ? `${SF_BASE}/lightning/r/Account/${r.sfId}/view` : ''
  const location = [r.state, r.country].filter(Boolean).join(', ')
  const ownerName = (r.ownerId && ownerMap[r.ownerId]) ? ownerMap[r.ownerId] : (r.ownerId || '')

  const canEdit = isMaster && !isIgnored && !isMerged
  const displayName    = masterUpdate.name    !== undefined ? masterUpdate.name    : r.name
  const displayWebsite = masterUpdate.website !== undefined ? masterUpdate.website : (r.website || '')
  const displayOwnerId = masterUpdate.ownerId !== undefined ? masterUpdate.ownerId : (r.ownerId || '')

  const nameChanged    = masterUpdate.name    !== undefined && masterUpdate.name    !== r.name
  const websiteChanged = masterUpdate.website !== undefined && masterUpdate.website !== r.website
  const ownerChanged   = masterUpdate.ownerId !== undefined && masterUpdate.ownerId !== r.ownerId

  const websiteClean = displayWebsite ? displayWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : ''

  const rowBg = isMaster ? '#dcfce7' : isIgnored ? 'var(--bg-subtle)' : '#fef2f2'
  const isVictimClickable = !isMaster && !isIgnored && !isMerged

  const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: 12 }
  const changedBg = '#eff6ff'
  const inputStyle: React.CSSProperties = { border: '1px solid var(--blue-300, #93c5fd)', borderRadius: 4, padding: '2px 6px', fontSize: 12, fontFamily: 'inherit', background: '#fff', width: '100%', minWidth: 80 }
  const actionBtnStyle: React.CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', lineHeight: 1.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <tr
      style={{ background: rowBg, cursor: isVictimClickable ? 'pointer' : 'default', opacity: isIgnored ? 0.7 : 1 }}
      onClick={isVictimClickable ? () => onApplyOverride(clusterId, r.id) : undefined}
      title={isVictimClickable ? 'Click to make this the master' : undefined}
    >
      <td style={td}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99,
          fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          ...(isMaster ? { background: '#dcfce7', color: '#166534' } : { background: '#fee2e2', color: '#991b1b' }),
        }}>
          {isMaster ? 'Master' : 'Victim'}
        </span>
      </td>

      {/* Name */}
      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isMaster ? 600 : 400, background: nameChanged ? changedBg : undefined }}>
        {canEdit && editing
          ? <input type="text" value={displayName} onChange={e => onMasterUpdate(clusterId, 'name', e.target.value)}
              onClick={e => e.stopPropagation()} placeholder="Company name" style={inputStyle} />
          : <span title={displayName}>{displayName || <em style={{ opacity: 0.5 }}>—</em>}</span>
        }
      </td>

      {/* Website */}
      <td style={{ ...td, background: websiteChanged ? changedBg : undefined }}>
        {canEdit && editing
          ? <input type="text" value={displayWebsite} onChange={e => onMasterUpdate(clusterId, 'website', e.target.value)}
              onClick={e => e.stopPropagation()} placeholder="https://…" style={inputStyle} />
          : (websiteClean
              ? <a href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--blue-500)', textDecoration: 'none' }}>{websiteClean}</a>
              : '—')}
      </td>

      <td style={{ ...td, color: 'var(--fg-3)' }}>{location || '—'}</td>

      {/* Owner */}
      <td style={{ ...td, background: ownerChanged ? changedBg : undefined }}>
        {canEdit && editing && Object.keys(ownerMap).length > 0
          ? <select value={displayOwnerId} onChange={e => { e.stopPropagation(); onMasterUpdate(clusterId, 'ownerId', e.target.value) }}
              onClick={e => e.stopPropagation()}
              style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
              <option value="">— select —</option>
              {Object.entries(ownerMap).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) =>
                <option key={id} value={id}>{name}</option>
              )}
            </select>
          : (ownerName || '—')}
      </td>

      <td style={{ ...td, color: 'var(--fg-3)' }}>{r.createdDate || '—'}</td>
      <td style={{ ...td, color: 'var(--fg-3)' }}>{r.lastSalesActivity || '—'}</td>
      <td style={{ ...td, color: 'var(--fg-3)' }}>{r.aiResearchLastCompleted || '—'}</td>
      <td style={{ ...td, textAlign: 'center', color: r.toBeDeleted ? 'var(--green-700)' : 'var(--fg-3)' }}>{r.toBeDeleted ? '✓' : '—'}</td>
      <td style={{ ...td, textAlign: 'center' }}>{r.contacts}</td>
      <td style={{ ...td, textAlign: 'center' }}>{r.deals || 0}</td>

      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
        <a href={hsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          style={{ color: '#e8622a', textDecoration: 'none', fontWeight: 500 }}>
          {r.id}
        </a>
      </td>

      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
        {sfUrl
          ? <a href={sfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ color: '#0070d2', textDecoration: 'none', fontWeight: 500 }}>
              {r.sfId}
            </a>
          : <span style={{ color: 'var(--fg-3)' }}>—</span>}
      </td>

      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {canEdit && !editing && (
            <button
              onClick={e => { e.stopPropagation(); setEditing(true) }}
              title="Edit master record"
              style={{ ...actionBtnStyle, color: 'var(--fg-2)' }}
            >
              <PencilIcon />
            </button>
          )}
          {canEdit && editing && (
            <button
              onClick={e => { e.stopPropagation(); setEditing(false) }}
              title="Done editing"
              style={{ ...actionBtnStyle, background: 'var(--blue-500)', border: 'none', color: '#fff', fontWeight: 600, padding: '2px 8px' }}
            >
              Done
            </button>
          )}
          {!isMaster && !isMerged && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveRecord(clusterId, r.id) }}
              disabled={isIgnored}
              title="Remove this record from the cluster"
              style={{ ...actionBtnStyle, color: 'var(--red-600)' }}
            >✕</button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ClusterCard({
  cluster, masterId, masterUpdate, ownerMap,
  mergeState, mergeError, isIgnored, isSelected,
  onMerge, onIgnore, onUnignore, onSelect, onApplyOverride, onRemoveRecord, onMasterUpdate,
}: Props) {
  const allRecs = Object.values(cluster.records)
  const isMerged = mergeState === 'done'
  const isRunning = mergeState === 'running'
  const isError = mergeState === 'error'
  const isConflict = cluster.flagType === 'conflict'
  const conflictResolved = isConflict && cluster.resolved

  const masterRec = cluster.records[masterId]

  // Border color
  const borderColor = isError ? 'var(--red-500)'
    : isMerged ? 'var(--green-600)'
    : isRunning ? 'var(--orange-500)'
    : isConflict ? 'var(--purple-500)'
    : cluster.flagType === 'nosf' ? 'var(--amber-400)'
    : 'var(--border)'
  const borderLeft = (isConflict || cluster.flagType === 'nosf') ? `3px solid ${borderColor}` : `1px solid ${borderColor}`

  const th: React.CSSProperties = {
    textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--fg-3)', padding: '6px 10px',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-subtle)',
  }

  return (
    <div
      id={`cc-${cluster.clusterId}`}
      style={{
        background: isIgnored ? 'var(--bg-subtle)' : 'var(--bg)',
        border: borderLeft,
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 8,
        opacity: isMerged || isIgnored ? 0.75 : 1,
        outline: isSelected ? '2px solid var(--orange-500)' : 'none',
        outlineOffset: -1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isMerged}
          onChange={e => onSelect(cluster.clusterId, e.target.checked)}
          onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--orange-500)', flexShrink: 0 }}
        />

        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {masterRec?.name || cluster.clusterId}
        </span>

        {/* Flags */}
        {isIgnored && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--fg-3)' }}>⊘ Ignored</span>}
        {!isIgnored && isConflict && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--purple-50)', color: 'var(--purple-500)' }} title={conflictDescription(cluster, masterId)}>⚠ Conflict</span>}
        {!isIgnored && cluster.flagType === 'nosf' && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#fef9c3', color: '#854d0e' }}>No SF record</span>}

        {/* Merge status */}
        {isRunning && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: '#fff7ed', color: 'var(--orange-700)' }}>
          <span style={{ width: 11, height: 11, border: '2px solid rgba(0,0,0,0.12)', borderTopColor: 'var(--orange-500)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block' }} />
          Merging…
        </span>}
        {isMerged && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>✓ Merged</span>}
        {isError && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--red-50)', color: 'var(--red-600)' }}>✗ Error</span>}

        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{allRecs.length} record{allRecs.length !== 1 ? 's' : ''}</span>

        {!isMerged && (
          <button
            onClick={() => isIgnored ? onUnignore(cluster.clusterId) : onIgnore(cluster.clusterId)}
            disabled={!!mergeState && !isIgnored}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: 'var(--fg-2)' }}
          >
            {isIgnored ? '↩ Unignore' : '⊘ Ignore'}
          </button>
        )}

        {!isIgnored && !mergeState && (
          <button
            onClick={() => onMerge(cluster.clusterId)}
            style={{ background: 'var(--orange-500)', border: 'none', borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#fff' }}
          >
            ▶ Merge
          </button>
        )}
      </div>

      {/* Conflict description */}
      {isConflict && !isIgnored && (
        <div style={{ fontSize: 12, color: 'var(--purple-500)', marginBottom: 8, padding: '6px 8px', background: 'var(--purple-50)', borderRadius: 5 }}>
          {conflictDescription(cluster, masterId)}
        </div>
      )}

      {/* Merge error */}
      {isError && mergeError && (
        <div style={{ fontSize: 12, color: 'var(--red-600)', marginBottom: 8, padding: '6px 8px', background: 'var(--red-50)', borderRadius: 5, borderLeft: '3px solid var(--red-500)' }}>
          <strong>Merge error:</strong> {mergeError}
        </div>
      )}

      {/* Record table */}
      <div style={{ overflowX: 'auto', marginTop: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Role', 'Name', 'Website', 'Location', 'Owner', 'Created', 'Last Activity', 'AI Research', 'To Delete', 'Contacts', 'Deals', 'HubSpot ID', 'Salesforce ID', ''].map((h, i) => (
                <th key={i} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRecs.map(r => (
              <RecordRow
                key={r.id}
                r={r}
                isMaster={r.id === masterId}
                isIgnored={isIgnored}
                isMerged={isMerged}
                clusterId={cluster.clusterId}
                masterUpdate={masterUpdate}
                ownerMap={ownerMap}
                onApplyOverride={onApplyOverride}
                onRemoveRecord={onRemoveRecord}
                onMasterUpdate={onMasterUpdate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Override hint */}
      {!isMerged && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 8 }}>
          {!isIgnored && <span>↑ Click a victim row to promote it to master.</span>}
          {isConflict && !conflictResolved && !isIgnored && (
            <span style={{ color: 'var(--purple-500)', fontWeight: 600 }}>⚠ Click the row you want to keep as master to resolve this conflict.</span>
          )}
          {isConflict && conflictResolved && !isIgnored && (
            <span style={{ color: 'var(--green-700)', fontWeight: 600 }}>✓ Conflict resolved</span>
          )}
        </div>
      )}
    </div>
  )
}
