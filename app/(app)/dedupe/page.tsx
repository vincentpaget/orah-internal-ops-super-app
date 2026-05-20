'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { parseCSV, buildClusters, computeStats, getMasterId, getVictimIds, type ClusterObj, type DedupeStats } from '@/lib/dedupe'
import ClusterCard from '@/components/dedupe/ClusterCard'
import SidebarStats from '@/components/dedupe/SidebarStats'
import ReviewStatsBar from '@/components/dedupe/ReviewStatsBar'
import ActivityLog, { type LogEntry } from '@/components/dedupe/ActivityLog'
import LogicPane from '@/components/dedupe/LogicPane'

const PAGE_SIZE = 50

type Tab = 'upload' | 'review' | 'logic'
type FilterType = 'all' | 'ready' | 'needsreview' | 'ignored' | 'merged' | 'errors'
type MergeStateVal = 'running' | 'done' | 'error'
interface MasterUpdate { name?: string; website?: string; ownerId?: string }

function isMerged(id: string, mergeStates: Record<string, MergeStateVal>) { return mergeStates[id] === 'done' }
function isError(id: string, mergeStates: Record<string, MergeStateVal>) { return mergeStates[id] === 'error' }

function filterClusters(
  clusters: ClusterObj[],
  filter: FilterType,
  ignored: Set<string>,
  mergeStates: Record<string, MergeStateVal>
): ClusterObj[] {
  switch (filter) {
    case 'ready': return clusters.filter(c =>
      !ignored.has(c.clusterId) &&
      !isMerged(c.clusterId, mergeStates) &&
      !isError(c.clusterId, mergeStates) &&
      !(c.flagType === 'conflict' && !c.resolved) &&
      c.flagType !== 'nosf')
    case 'needsreview': return clusters.filter(c =>
      !ignored.has(c.clusterId) &&
      !isMerged(c.clusterId, mergeStates) &&
      !isError(c.clusterId, mergeStates) &&
      ((c.flagType === 'conflict' && !c.resolved) || c.flagType === 'nosf'))
    case 'ignored': return clusters.filter(c => ignored.has(c.clusterId))
    case 'merged': return clusters.filter(c => isMerged(c.clusterId, mergeStates))
    case 'errors': return clusters.filter(c => isError(c.clusterId, mergeStates))
    default: return clusters
  }
}

function filterCounts(
  clusters: ClusterObj[],
  ignored: Set<string>,
  mergeStates: Record<string, MergeStateVal>
) {
  let ready = 0, needsreview = 0, mergedCount = 0, errors = 0, ignoredCount = 0
  for (const c of clusters) {
    if (ignored.has(c.clusterId)) { ignoredCount++; continue }
    if (isMerged(c.clusterId, mergeStates)) { mergedCount++; continue }
    if (isError(c.clusterId, mergeStates)) { errors++; continue }
    if ((c.flagType === 'conflict' && !c.resolved) || c.flagType === 'nosf') { needsreview++; continue }
    ready++
  }
  return { all: clusters.length, ready, needsreview, merged: mergedCount, errors, ignored: ignoredCount }
}

export default function DedupePage() {
  const [tab, setTab] = useState<Tab>('upload')
  const [clusters, setClusters] = useState<ClusterObj[]>([])
  const [ignored, setIgnored] = useState<Set<string>>(new Set())
  const [mergeStates, setMergeStates] = useState<Record<string, MergeStateVal>>({})
  const [mergeErrors, setMergeErrors] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [masterUpdates, setMasterUpdates] = useState<Record<string, MasterUpdate>>({})
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterType>('ready')
  const [page, setPage] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [rawRows, setRawRows] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [filename, setFilename] = useState('')
  const [auditHeight, setAuditHeight] = useState(160)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [mergedTotal, setMergedTotal] = useState(0)
  const [remappedTotal, setRemappedTotal] = useState(0)
  const [markedTotal, setMarkedTotal] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'error' | 'info'; msg: string } | null>(null)

  // Stable refs for async callbacks
  const clustersRef = useRef(clusters)
  const ignoredRef = useRef(ignored)
  const overridesRef = useRef(overrides)
  const masterUpdatesRef = useRef(masterUpdates)
  useEffect(() => { clustersRef.current = clusters }, [clusters])
  useEffect(() => { ignoredRef.current = ignored }, [ignored])
  useEffect(() => { overridesRef.current = overrides }, [overrides])
  useEffect(() => { masterUpdatesRef.current = masterUpdates }, [masterUpdates])

  const audit = useCallback((kind: LogEntry['kind'], msg: string) => {
    setLog(prev => [...prev, { ts: Date.now(), kind, msg }])
  }, [])

  // Load owners on mount
  useEffect(() => {
    fetch('/api/dedupe/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getOwners' }) })
      .then(r => r.json())
      .then(data => { if (data.owners) setOwnerMap(data.owners) })
      .catch(() => {})
  }, [])

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        if (rows.length === 0) { setUploadStatus({ type: 'error', msg: 'CSV appears empty or unreadable.' }); return }
        if (!headers.includes('ID_1') || !headers.includes('ID_2')) {
          setUploadStatus({ type: 'error', msg: 'Columns ID_1 and ID_2 not found. This does not look like a HubSpot "Manage Duplicate Companies" export.' }); return
        }
        if (!headers.includes('SALESFORCEACCOUNTID_1')) {
          setUploadStatus({ type: 'error', msg: 'Column SALESFORCEACCOUNTID_1 not found. Please export with all company properties included.' }); return
        }
        const { clusters: built, totalRecords: tr } = buildClusters(rows)
        if (built.length === 0) { setUploadStatus({ type: 'error', msg: 'No duplicate clusters found in this CSV.' }); return }
        setClusters(built)
        setRawRows(rows.length)
        setTotalRecords(tr)
        setFilename(file.name)
        setIgnored(new Set())
        setMergeStates({})
        setMergeErrors({})
        setSelected(new Set())
        setMasterUpdates({})
        setOverrides({})
        setLog([])
        setPage(0)
        setFilter('ready')
        setMergedTotal(0); setRemappedTotal(0); setMarkedTotal(0)
        setUploadStatus(null)
        setTab('review')
        audit('info', `Loaded ${file.name}: ${built.length} clusters from ${rows.length} duplicate pairs (${tr} unique records) — columns found: ${headers.length}`)
      } catch (err) {
        setUploadStatus({ type: 'error', msg: `Parse error: ${err instanceof Error ? err.message : String(err)}` })
      }
    }
    reader.readAsText(file)
  }

  const getClusterMasterId = useCallback((c: ClusterObj) => getMasterId(c, overridesRef.current), [])
  const getClusterVictimIds = useCallback((c: ClusterObj) => getVictimIds(c, overridesRef.current), [])

  const mergeCluster = useCallback(async (clusterId: string) => {
    const cluster = clustersRef.current.find(c => c.clusterId === clusterId)
    if (!cluster || ignoredRef.current.has(clusterId)) return

    setMergeStates(prev => ({ ...prev, [clusterId]: 'running' }))

    const mid = getMasterId(cluster, overridesRef.current)
    const master = cluster.records[mid]
    const vids = getVictimIds(cluster, overridesRef.current)
    const label = `"${master?.name || clusterId}"`
    let hasError = false
    const errorMessages: string[] = []

    // Step 0: apply master property overrides
    const updates = masterUpdatesRef.current[clusterId]
    if (updates) {
      const props: Record<string, string> = {}
      if (updates.name !== undefined && updates.name !== master?.name) props.name = updates.name
      if (updates.website !== undefined && updates.website !== master?.website) props.website = updates.website
      if (updates.ownerId !== undefined && updates.ownerId !== master?.ownerId) props.hubspot_owner_id = updates.ownerId
      if (Object.keys(props).length > 0) {
        try {
          const res = await fetch('/api/dedupe/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateCompany', companyId: mid, properties: props }) })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
          audit('info', `${label} master properties updated (${Object.keys(props).join(', ')})`)
        } catch (err) {
          audit('warn', `${label} master update skipped: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    // Step 1: Salesforce merge
    const sfPairs = vids
      .map(vid => ({ masterSfId: master?.sfId, victimSfId: cluster.records[vid]?.sfId, victimHsId: vid }))
      .filter(p => p.masterSfId && p.victimSfId)

    if (sfPairs.length > 0) {
      try {
        const res = await fetch('/api/dedupe/salesforce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', batch: sfPairs }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        for (const f of (data.autoFixed ?? [])) audit('warn', `${label} SF: auto-fixed shared contacts on ${f.victimSfId} (${f.fixed} ACR removed)`)
        for (const e of (data.errors ?? [])) { audit('err', `${label} SF merge error — ${e.victimSfId}: ${e.message}`); errorMessages.push(`SF: ${e.message}`); hasError = true }
        if (!data.errors?.length) {
          audit('ok', `${label} SF: ${data.merged} account${data.merged !== 1 ? 's' : ''} merged`)
          setMergedTotal(t => t + (data.merged ?? 0))
        }
      } catch (err) {
        audit('err', `${label} SF merge failed: ${err instanceof Error ? err.message : String(err)}`)
        errorMessages.push(`SF: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    // Step 2: HubSpot contact remap
    let hasRemapError = false
    try {
      const res = await fetch('/api/dedupe/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remap', batch: vids.map(vid => ({ masterId: mid, victimId: vid })) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      let remapped = 0
      for (const d of (data.detail ?? [])) {
        if (d.ok && d.contactsFound === 0) audit('info', `${label} remap: victim ${d.victimId} had 0 contacts`)
        else if (d.ok) { audit('ok', `${label} remap: ${d.contactsFound} contact${d.contactsFound !== 1 ? 's' : ''} moved from ${d.victimId}`); remapped += d.contactsFound }
        else { audit('err', `${label} remap error — ${d.victimId}: ${d.error}`); errorMessages.push(`Remap: ${d.error}`); hasError = true; hasRemapError = true }
      }
      if (remapped > 0) setRemappedTotal(t => t + remapped)
    } catch (err) {
      audit('err', `${label} HubSpot remap failed: ${err instanceof Error ? err.message : String(err)}`)
      errorMessages.push(`Remap: ${err instanceof Error ? err.message : String(err)}`)
      hasError = true; hasRemapError = true
    }

    // Step 3: Mark victims for deletion (skip if remap errored)
    if (hasRemapError) {
      audit('warn', `${label}: skipping mark-for-deletion because remap had errors`)
    } else {
      try {
        const res = await fetch('/api/dedupe/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark', victimIds: vids }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        if ((data.marked ?? 0) > 0) { audit('ok', `${label}: ${data.marked} victim${data.marked !== 1 ? 's' : ''} marked for deletion`); setMarkedTotal(t => t + data.marked) }
        if ((data.skipped ?? []).length > 0) audit('warn', `${label}: ${data.skipped.length} victim${data.skipped.length !== 1 ? 's' : ''} skipped — still have contacts`)
        for (const e of (data.errors ?? [])) { audit('err', `${label} mark error — ${e.id}: ${e.message}`); errorMessages.push(`Mark: ${e.message}`); hasError = true }
      } catch (err) {
        audit('err', `${label} mark step failed: ${err instanceof Error ? err.message : String(err)}`)
        errorMessages.push(`Mark: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    setMergeStates(prev => ({ ...prev, [clusterId]: hasError ? 'error' : 'done' }))
    if (hasError) setMergeErrors(prev => ({ ...prev, [clusterId]: errorMessages.join(' · ') }))
  }, [audit])

  async function handleBulkMerge(ids: string[]) {
    const toMerge = ids.filter(id => {
      const c = clustersRef.current.find(cl => cl.clusterId === id)
      return c && !ignoredRef.current.has(id) && mergeStates[id] !== 'done' && mergeStates[id] !== 'running'
    })
    if (!toMerge.length) return
    setSelected(new Set())
    setBulkProgress({ current: 0, total: toMerge.length })
    for (let i = 0; i < toMerge.length; i++) {
      setBulkProgress({ current: i + 1, total: toMerge.length })
      await mergeCluster(toMerge[i])
    }
    setBulkProgress(null)
  }

  function handleBulkIgnore(ids: string[]) {
    const toIgnore = ids.filter(id => !isMerged(id, mergeStates))
    setIgnored(prev => { const s = new Set(prev); toIgnore.forEach(id => s.add(id)); return s })
    setSelected(new Set())
    audit('info', `Ignored ${toIgnore.length} cluster${toIgnore.length !== 1 ? 's' : ''}`)
  }

  function handleIgnore(clusterId: string) {
    setIgnored(prev => { const s = new Set(prev); s.add(clusterId); return s })
  }

  function handleUnignore(clusterId: string) {
    setIgnored(prev => { const s = new Set(prev); s.delete(clusterId); return s })
  }

  function handleApplyOverride(clusterId: string, newMasterId: string) {
    setOverrides(prev => ({ ...prev, [clusterId]: newMasterId }))
    setClusters(prev => prev.map(c => c.clusterId === clusterId && c.flagType === 'conflict' ? { ...c, resolved: true } : c))
    const cluster = clustersRef.current.find(c => c.clusterId === clusterId)
    const newMaster = cluster?.records[newMasterId]
    if (newMaster && !newMaster.sfId) {
      audit('warn', `"${newMaster.name || newMasterId}" has no Salesforce ID — SF merge step will be skipped`)
    }
  }

  function handleRemoveRecord(clusterId: string, recordId: string) {
    setClusters(prev => {
      const idx = prev.findIndex(c => c.clusterId === clusterId)
      if (idx === -1) return prev
      const c = prev[idx]
      const remaining = Object.keys(c.records).filter(id => id !== recordId)
      if (remaining.length <= 1) {
        audit('warn', `Cluster dissolved — only ${remaining.length} record remains`)
        setIgnored(ig => { const s = new Set(ig); s.add(clusterId); return s })
        return prev
      }
      const records = Object.fromEntries(remaining.map(id => [id, c.records[id]]))
      const newOverride = overridesRef.current[clusterId]
      const masterId = (newOverride === recordId || !newOverride) ? remaining[0] : (newOverride ?? remaining[0])
      const newCluster = { ...c, records, masterId, victimIds: remaining.filter(id => id !== masterId) }
      const updated = [...prev]
      updated[idx] = newCluster
      return updated
    })
  }

  function handleMasterUpdate(clusterId: string, field: 'name' | 'website' | 'ownerId', value: string) {
    setMasterUpdates(prev => ({ ...prev, [clusterId]: { ...(prev[clusterId] ?? {}), [field]: value } }))
  }

  function handleSelect(clusterId: string, checked: boolean) {
    setSelected(prev => { const s = new Set(prev); checked ? s.add(clusterId) : s.delete(clusterId); return s })
  }

  function toggleSelectPage(checked: boolean) {
    const pageIds = paginated.map(c => c.clusterId)
    setSelected(prev => {
      const s = new Set(prev)
      pageIds.forEach(id => checked ? s.add(id) : s.delete(id))
      return s
    })
  }

  function selectAllPages() {
    setSelected(new Set(filtered.filter(c => !isMerged(c.clusterId, mergeStates)).map(c => c.clusterId)))
  }

  function clearSelection() { setSelected(new Set()) }

  function changeFilter(f: FilterType) { setFilter(f); setPage(0); clearSelection() }
  function changePage(p: number) { setPage(p); clearSelection() }

  // Computed values
  const stats: DedupeStats = useMemo(() => computeStats(clusters, ignored), [clusters, ignored])
  const filtered = useMemo(() => filterClusters(clusters, filter, ignored, mergeStates), [clusters, filter, ignored, mergeStates])
  const counts = useMemo(() => filterCounts(clusters, ignored, mergeStates), [clusters, ignored, mergeStates])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const pageSelected = paginated.filter(c => !isMerged(c.clusterId, mergeStates))
  const allPageChecked = pageSelected.length > 0 && pageSelected.every(c => selected.has(c.clusterId))
  const allFilteredSelected = filtered.filter(c => !isMerged(c.clusterId, mergeStates)).every(c => selected.has(c.clusterId))
  const showSelectAllBanner = allPageChecked && !allFilteredSelected && selected.size > 0

  const conflictsRemaining = useMemo(() =>
    clusters.filter(c => c.flagType === 'conflict' && !c.resolved && !ignored.has(c.clusterId) && !isMerged(c.clusterId, mergeStates)).length,
    [clusters, ignored, mergeStates]
  )

  const showPipeline = mergedTotal > 0 || remappedTotal > 0 || markedTotal > 0

  // ──────────────────────────────────────────────
  // Styles
  const navTabStyle = (active: boolean, locked: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontSize: 13, fontWeight: active ? 600 : 500,
    color: active ? 'var(--navy-900)' : locked ? 'var(--fg-3)' : 'var(--fg-2)',
    cursor: locked ? 'not-allowed' : 'pointer',
    borderBottom: active ? '2px solid var(--orange-500)' : '2px solid transparent',
    transition: 'color 0.15s', userSelect: 'none' as const,
    pointerEvents: locked ? 'none' as const : 'auto' as const,
    opacity: locked ? 0.45 : 1,
  })

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px', borderRadius: 99, border: `1px solid ${active ? 'var(--navy-900)' : 'var(--border)'}`,
    fontSize: 12, cursor: 'pointer', background: active ? 'var(--navy-900)' : 'var(--bg)',
    color: active ? '#fff' : 'var(--fg-2)', userSelect: 'none',
  })

  const btnStyle = (variant: 'primary' | 'outline' | 'danger', disabled?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
    borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: variant === 'outline' ? '1px solid var(--border)' : 'none',
    background: disabled ? 'var(--bg-subtle)' : variant === 'primary' ? 'var(--orange-500)' : variant === 'danger' ? 'var(--red-500)' : 'var(--bg)',
    color: disabled ? 'var(--fg-3)' : variant === 'outline' ? 'var(--fg-2)' : '#fff',
    opacity: disabled ? 0.5 : 1,
  })

  // Drop zone handlers
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div style={{ margin: '-32px -40px -64px', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-subtle)' }}>

      {/* Tool tab nav */}
      <nav style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', padding: '0 20px', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', paddingRight: 20, paddingBottom: 10, borderRight: '1px solid var(--border)', marginRight: 4, whiteSpace: 'nowrap' }}>CRM Dedupe</span>
        <div style={navTabStyle(tab === 'upload', false)} onClick={() => setTab('upload')}>Upload</div>
        <div style={navTabStyle(tab === 'review', clusters.length === 0)} onClick={() => clusters.length > 0 && setTab('review')}>Review</div>
        <div style={navTabStyle(tab === 'logic', false)} onClick={() => setTab('logic')}>Logic</div>
      </nav>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 210, background: 'var(--bg)', borderRight: '1px solid var(--border)', padding: '18px 14px', flexShrink: 0, overflowY: 'auto' }}>
          <SidebarStats
            stats={stats}
            sfMerged={mergedTotal}
            remapped={remappedTotal}
            markedForDeletion={markedTotal}
            showPipeline={showPipeline}
          />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* ── UPLOAD PANE ── */}
          {tab === 'upload' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Upload Duplicate CSV</div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>
                Export from HubSpot → Companies → Actions → Manage Duplicates, then drop that CSV here.
              </div>
              <div
                onDrop={e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => document.getElementById('dedupe-file-input')?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--orange-500)' : 'var(--border)'}`,
                  borderRadius: 10, background: isDragOver ? '#fff9f6' : 'var(--bg)',
                  textAlign: 'center', padding: '52px 32px', cursor: 'pointer', maxWidth: 580,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <input id="dedupe-file-input" type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <div style={{ fontSize: 38, marginBottom: 14 }}>📂</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>Drop your CSV file here</div>
                <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>HubSpot "Manage Duplicate Companies" export</div>
                <button
                  onClick={e => e.stopPropagation()}
                  onClickCapture={() => document.getElementById('dedupe-file-input')?.click()}
                  style={{ display: 'inline-block', marginTop: 16, padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Choose file
                </button>
              </div>
              {uploadStatus && (
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 6, fontSize: 13, background: uploadStatus.type === 'error' ? 'var(--red-50)' : 'var(--blue-50)', border: `1px solid ${uploadStatus.type === 'error' ? 'var(--red-100)' : 'var(--blue-50)'}`, color: uploadStatus.type === 'error' ? 'var(--red-600)' : 'var(--blue-600)' }}>
                  {uploadStatus.msg}
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW PANE ── */}
          {tab === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ flexShrink: 0, padding: '16px 24px 0' }}>

                {/* Stats bar */}
                <ReviewStatsBar
                  pairs={rawRows}
                  totalRecords={totalRecords}
                  clusters={clusters.length}
                  conflicts={conflictsRemaining}
                />

                {/* Filter chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Show:</span>
                  {([
                    ['all', 'All', counts.all],
                    ['ready', 'Ready to Merge', counts.ready],
                    ['needsreview', '⚠ Needs Review', counts.needsreview],
                    ['ignored', 'Ignored', counts.ignored],
                    ['merged', '✓ Merged', counts.merged],
                    ...(counts.errors > 0 ? [['errors', '✗ Errors', counts.errors]] : []),
                  ] as [FilterType, string, number][]).map(([f, label, count]) => (
                    <div key={f} style={chipStyle(filter === f)} onClick={() => changeFilter(f)}>
                      {label} ({count})
                    </div>
                  ))}
                </div>

                {/* Bulk action bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: -2, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={allPageChecked} onChange={e => toggleSelectPage(e.target.checked)}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--orange-500)' }} />
                    Select this page
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', minWidth: 80 }}>
                    {selected.size > 0 ? `${selected.size} selected` : ''}
                  </span>
                  <button disabled={selected.size === 0} onClick={() => handleBulkMerge([...selected])} style={btnStyle('primary', selected.size === 0)}>
                    ▶ Merge Selected
                  </button>
                  <button disabled={selected.size === 0} onClick={() => handleBulkIgnore([...selected])} style={btnStyle('outline', selected.size === 0)}>
                    ⊘ Ignore Selected
                  </button>
                  {selected.size > 0 && (
                    <button onClick={clearSelection} style={btnStyle('outline')}>✕ Clear</button>
                  )}
                </div>

                {/* Select all pages banner */}
                {showSelectAllBanner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', background: 'var(--blue-50)', margin: '0 -24px', paddingLeft: 24, fontSize: 12, color: 'var(--blue-600)', borderTop: '1px solid #bfdbfe', marginBottom: 0 }}>
                    <span>Page selected — {filtered.filter(c => !isMerged(c.clusterId, mergeStates)).length} clusters total in this filter.</span>
                    <button onClick={selectAllPages} style={{ padding: '2px 10px', fontSize: 12, color: 'var(--blue-600)', border: '1px solid #93c5fd', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>Select all</button>
                    <button onClick={clearSelection} style={{ padding: '2px 10px', fontSize: 12, color: 'var(--fg-3)', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}>Clear</button>
                  </div>
                )}

                {/* Bulk progress bar */}
                {bulkProgress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', background: 'var(--green-50)', margin: '0 -24px', paddingLeft: 24, fontSize: 12, color: 'var(--green-700)', borderTop: '1px solid #bbf7d0' }}>
                    <span style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.12)', borderTopColor: 'var(--green-700)', borderRadius: '50%', animation: 'spin 0.65s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                    <span>Merging {bulkProgress.current} of {bulkProgress.total}…</span>
                    <div style={{ flex: 1, background: '#bbf7d0', borderRadius: 4, height: 6, overflow: 'hidden', marginRight: 24 }}>
                      <div style={{ height: '100%', background: 'var(--green-700)', borderRadius: 4, transition: 'width 0.2s', width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Cluster scroll area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px', minHeight: 0 }}>
                {paginated.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                    No clusters match this filter.
                  </div>
                ) : (
                  paginated.map(c => (
                    <ClusterCard
                      key={c.clusterId}
                      cluster={c}
                      masterId={getMasterId(c, overrides)}
                      masterUpdate={masterUpdates[c.clusterId] ?? {}}
                      ownerMap={ownerMap}
                      mergeState={mergeStates[c.clusterId]}
                      mergeError={mergeErrors[c.clusterId]}
                      isIgnored={ignored.has(c.clusterId)}
                      isSelected={selected.has(c.clusterId)}
                      onMerge={mergeCluster}
                      onIgnore={handleIgnore}
                      onUnignore={handleUnignore}
                      onSelect={handleSelect}
                      onApplyOverride={handleApplyOverride}
                      onRemoveRecord={handleRemoveRecord}
                      onMasterUpdate={handleMasterUpdate}
                    />
                  ))
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
                    <button onClick={() => changePage(Math.max(0, page - 1))} disabled={page === 0} style={btnStyle('outline', page === 0)}>← Prev</button>
                    <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Page {page + 1} of {totalPages}</span>
                    <button onClick={() => changePage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={btnStyle('outline', page >= totalPages - 1)}>Next →</button>
                  </div>
                )}
              </div>

              {/* Resizable audit panel */}
              {log.length > 0 && (
                <ActivityLog entries={log} height={auditHeight} onHeightChange={setAuditHeight} />
              )}
            </div>
          )}

          {/* ── LOGIC PANE ── */}
          {tab === 'logic' && <LogicPane />}

        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
