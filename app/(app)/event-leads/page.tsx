'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import LeadTable, { type Lead, type FlaggedItem, STATUS_RANK } from '@/components/event-leads/LeadTable'

type ImportSource = 'notion' | 'csv'
type ActiveTab = 'results' | 'audit'
type Phase = 'upload' | 'processing' | 'done'

interface AuditEntry { type: string; detail: string; ts: number }
interface NotionData { sf_campaign_id: string; sf_campaign_name: string; csv: string }
interface LogLine { type: string; msg: string; ts: number }
interface N8nResult { phase: 'pending' | 'success' | 'error'; data?: Record<string, unknown>; error?: string }

const STATUS_PRIORITY = [
  { label: 'Demo Interest (MQL)',       rank: 5, style: { bg: '#fdf0f9', color: '#9b1f6b',         border: '#f5c6e7' } },
  { label: 'Expansion Interest (CMQL)', rank: 4, style: { bg: '#eff6ff', color: 'var(--blue-600)', border: '#bfdbfe' } },
  { label: 'CSM FUp Required',          rank: 3, style: { bg: '#fff7ed', color: 'var(--orange-700)',border: '#fed7aa' } },
  { label: 'Engaged Outside Booth',     rank: 2, style: { bg: '#f0fdf4', color: 'var(--green-700)', border: '#bbf7d0' } },
  { label: 'Visited Booth',             rank: 1, style: { bg: 'var(--bg)', color: 'var(--fg-3)',    border: 'var(--border)' } },
  { label: 'RSVP',                      rank: 0, style: { bg: 'var(--bg)', color: 'var(--fg-3)',    border: 'var(--border)' } },
]

const LOG_COLOR: Record<string, string> = {
  step: '#4ade80', info: 'rgba(255,255,255,0.55)', warn: '#fbbf24', err: '#f87171', merge: '#fb923c', flag: '#c084fc',
}

export default function EventLeadsPage() {
  // Import
  const [importSource, setImportSource] = useState<ImportSource>('notion')
  const [notionUrl, setNotionUrl] = useState('')
  const [notionData, setNotionData] = useState<NotionData | null>(null)
  const [notionStatus, setNotionStatus] = useState<{ msg: string; type: '' | 'ok' | 'err' }>({ msg: '', type: '' })
  const [notionFetching, setNotionFetching] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvName, setCsvName] = useState('')
  const [sfCampaignId, setSfCampaignId] = useState('')
  const [csvFilename, setCsvFilename] = useState('')

  // Results
  const [leads, setLeads] = useState<Lead[]>([])
  const [flagged, setFlagged] = useState<FlaggedItem[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [eventName, setEventName] = useState('')

  // UI state
  const [phase, setPhase] = useState<Phase>('upload')
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('results')
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [n8nResult, setN8nResult] = useState<N8nResult | null>(null)
  const [n8nBusy, setN8nBusy] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  const addLog = useCallback((type: string, msg: string) => {
    setLogLines(prev => [...prev, { type, msg, ts: Date.now() }])
  }, [])

  // ── Source toggle ──────────────────────────────────────────────────────────
  function switchSource(src: ImportSource) {
    setImportSource(src)
    if (src === 'notion') { setNotionData(null); setNotionStatus({ msg: '', type: '' }) }
  }

  // ── Notion fetch ──────────────────────────────────────────────────────────
  async function fetchNotion() {
    if (!notionUrl.trim()) return
    setNotionFetching(true)
    setNotionStatus({ msg: 'Fetching from Notion…', type: '' })
    try {
      const res = await fetch(`/api/event-leads/notion?url=${encodeURIComponent(notionUrl.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (!data.rows?.length) throw new Error('No rows returned from Notion')
      const csv = notionRowsToCSV(data)
      setNotionData({ sf_campaign_id: data.sf_campaign_id, sf_campaign_name: data.sf_campaign_name, csv })
      setEventName(data.sf_campaign_name || '')
      setNotionStatus({ msg: `✓ ${data.rows.length} rows loaded · SF Campaign ID: ${data.sf_campaign_id || 'not found'}`, type: 'ok' })
    } catch (e) {
      setNotionStatus({ msg: `Error: ${(e as Error).message}`, type: 'err' })
    } finally {
      setNotionFetching(false)
    }
  }

  function notionRowsToCSV(data: { sf_campaign_id: string; sf_campaign_name: string; rows: Record<string, string>[] }): string {
    const { sf_campaign_id = '', sf_campaign_name = '', rows = [] } = data
    const mapped = rows.map(r => ({
      'Person Name': r['Person Name'] || '',
      'First Name': r['First Name'] || '',
      'Last Name': r['Last Name'] || '',
      'Job Title': r['Job Title'] || '',
      'Email': r['Email'] || '',
      'School': r['School'] || '',
      'Status': r['Status'] || '',
      'Notes': r['Notes'] || '',
      'School Website': r['School Website'] || '',
      'Assigned To Email': r['Assign To Email'] || r['Assign to email'] || '',
      'SF Campaign ID': sf_campaign_id,
      'SF Campaign Name': sf_campaign_name,
    }))
    const headers = Object.keys(mapped[0] || {})
    if (!headers.length) return ''
    return [headers.join(','), ...mapped.map(row =>
      headers.map(h => `"${String((row as Record<string, string>)[h] || '').replace(/"/g, '""')}"`).join(',')
    )].join('\n')
  }

  // ── CSV file handling ─────────────────────────────────────────────────────
  function loadFile(file: File) {
    const r = new FileReader()
    r.onload = ev => {
      setCsvText(ev.target?.result as string || '')
      setCsvFilename(file.name)
    }
    r.readAsText(file)
  }

  function removeFile() {
    setCsvText(''); setCsvFilename('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) loadFile(f)
  }

  // ── Run ready check ───────────────────────────────────────────────────────
  const runReady = importSource === 'notion'
    ? notionData !== null
    : csvName.trim().length > 0 && sfCampaignId.trim().length > 0 && csvText.length > 0

  // ── Main processing ───────────────────────────────────────────────────────
  async function startProcessing() {
    if (busy) return
    let sourceCSV = ''
    let evName = eventName

    if (importSource === 'notion') {
      if (!notionData) { addLog('err', 'Fetch Notion data first'); return }
      sourceCSV = notionData.csv
      evName = eventName || notionData.sf_campaign_name || ''
    } else {
      if (!csvName || !sfCampaignId || !csvText) { addLog('err', 'Fill in all CSV fields'); return }
      evName = csvName
      const lines = csvText.trim().split('\n')
      lines[0] = lines[0].trimEnd() + ',SF Campaign ID'
      for (let i = 1; i < lines.length; i++) lines[i] = lines[i].trimEnd() + `,"${sfCampaignId}"`
      sourceCSV = lines.join('\n')
    }

    setBusy(true)
    setPhase('processing')
    setLogLines([])
    setLeads([]); setFlagged([]); setAuditEntries([])

    const log = (type: string, msg: string) => addLog(type, msg)

    try {
      const allLines = sourceCSV.trim().split('\n')
      const csvHeader = allLines[0]
      const dataRows = allLines.slice(1).filter(r => r.trim())
      const CHUNK = 20
      const chunks: string[] = []
      for (let i = 0; i < dataRows.length; i += CHUNK) {
        chunks.push([csvHeader, ...dataRows.slice(i, i + CHUNK)].join('\n'))
      }
      log('step', `Step 1 — Parsing ${dataRows.length} rows in ${chunks.length} parallel batch${chunks.length > 1 ? 'es' : ''}…`)

      const chunkResults = await Promise.all(chunks.map(async (chunk, idx) => {
        log('info', `Batch ${idx + 1}/${chunks.length} — rows ${idx * CHUNK + 1}–${Math.min((idx + 1) * CHUNK, dataRows.length)}…`)
        const r = await fetch('/api/event-leads/process', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: chunk, step: 'parse', event_name: evName }),
        })
        const result = await r.json()
        if (!r.ok) throw new Error(result.error || 'Parse step failed')
        log('info', `Batch ${idx + 1}/${chunks.length} done — ${result.leads?.length || 0} contacts`)
        return result
      }))

      let allLeads: Lead[] = [], allFlagged: FlaggedItem[] = [], allAudit: AuditEntry[] = []
      let eventNameClean = '', sfMissing = false

      for (const r of chunkResults) {
        allLeads.push(...(r.leads || []))
        allFlagged.push(...(r.flagged || []))
        allAudit.push(...(r.audit || []).map((a: AuditEntry) => ({ ...a, ts: Date.now() })))
        if (r.event_name_clean) eventNameClean = r.event_name_clean
        if (r.sf_campaign_id_missing) sfMissing = true
      }

      // Cross-chunk exact dedup by _key
      const seenKeys = new Map<string, Lead>()
      for (const l of allLeads) {
        if (!seenKeys.has(l._key)) { seenKeys.set(l._key, l); continue }
        const ex = seenKeys.get(l._key)!
        if ((STATUS_RANK[l.campaign_status] || 0) > (STATUS_RANK[ex.campaign_status] || 0)) ex.campaign_status = l.campaign_status
        if (!ex.email && l.email) { ex.email = l.email; ex.email_confidence = l.email_confidence }
        const extra = (l.all_notes || []).filter(n => n && !(ex.all_notes || []).includes(n))
        ex.all_notes = [...(ex.all_notes || []), ...extra]
      }
      allLeads = Array.from(seenKeys.values())
      if (eventNameClean) setEventName(eventNameClean)
      else if (!eventName && evName) setEventName(evName)

      if (sfMissing) {
        log('err', '✕ No SF Campaign ID found — check your input')
        setBusy(false); setPhase('upload'); return
      }

      // Step 1b: cross-chunk fuzzy dedup
      if (allLeads.length > 1) {
        log('info', `Checking ${allLeads.length} contacts for duplicates…`)
        const dedupRes = await fetch('/api/event-leads/process', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: sourceCSV, step: 'dedup', leads: allLeads.map(l => ({ _key: l._key, first_name: l.first_name, last_name: l.last_name, company: l.company })) }),
        })
        const dupeGroups = await dedupRes.json()
        if (Array.isArray(dupeGroups)) {
          for (const g of dupeGroups) {
            if (g.action === 'merge' && g.keys?.length > 1) {
              const toMerge = allLeads.filter(l => g.keys.includes(l._key))
              if (toMerge.length > 1) {
                const merged = { ...toMerge[0] }
                toMerge.slice(1).forEach(l => {
                  if ((STATUS_RANK[l.campaign_status] || 0) > (STATUS_RANK[merged.campaign_status] || 0)) merged.campaign_status = l.campaign_status
                  if (!merged.email && l.email) { merged.email = l.email; merged.email_confidence = l.email_confidence }
                  if (!merged.job_title && l.job_title) merged.job_title = l.job_title
                  const extra = (l.all_notes || []).filter(n => n && !(merged.all_notes || []).includes(n))
                  merged.all_notes = [...(merged.all_notes || []), ...extra]
                })
                allLeads = allLeads.filter(l => !g.keys.includes(l._key))
                allLeads.push(merged)
                allAudit.push({ type: 'merge', detail: g.reason, ts: Date.now() })
              }
            } else if (g.action === 'flag' && g.keys?.length) {
              allFlagged.push({ reason: g.reason, flag_type: 'duplicate', keys: g.keys, rows: g.keys })
              allAudit.push({ type: 'flag', detail: g.reason, ts: Date.now() })
            }
          }
        }
      }

      const mergeCount = allAudit.filter(a => a.type === 'merge').length
      const skipped = dataRows.length - allLeads.length - mergeCount
      let step1Msg = `Step 1 done — ${allLeads.length} contacts from ${dataRows.length} rows`
      if (mergeCount > 0) step1Msg += `, ${mergeCount} duplicate${mergeCount > 1 ? 's' : ''} merged`
      if (skipped > 0) step1Msg += `, ${skipped} skipped (no usable name/data)`
      log('step', step1Msg)
      allAudit.filter(a => a.type === 'merge').forEach(a => log('merge', `Merged: ${a.detail}`))
      allAudit.filter(a => a.type === 'flag').forEach(a => log('flag', `Flagged: ${a.detail}`))

      // Step 2: Notes summary
      const needSummary = allLeads.filter(l => l.all_notes?.length > 0)
      if (needSummary.length > 0) {
        log('step', `Step 2 — Summarising notes for ${needSummary.length} contact(s)…`)
        const sumRes = await fetch('/api/event-leads/process', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: sourceCSV, step: 'summarise', contacts: needSummary }),
        })
        const summaries = await sumRes.json()
        if (Array.isArray(summaries)) summaries.forEach(({ key, summary }: { key: string; summary: string }) => {
          const l = allLeads.find(x => x._key === key); if (l) l.notes_summary = summary
        })
        log('step', 'Step 2 done')
      }

      // Step 3: Email waterfall
      const needEmail = allLeads.filter(l => !l.email)
      log('step', `Step 3 — Email lookup for ${needEmail.length} contact(s)…`)
      if (needEmail.length > 0) {
        const emailRes = await fetch('/api/event-leads/process', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: sourceCSV, step: 'email', contacts: needEmail }),
        })
        const emails = await emailRes.json()
        if (Array.isArray(emails)) {
          let found = 0
          emails.forEach(({ key, email, confidence }: { key: string; email: string; confidence: string }) => {
            const l = allLeads.find(x => x._key === key)
            if (l && email) { l.email = email; l.email_confidence = confidence; found++ }
          })
          log(found > 0 ? 'step' : 'warn', `Email research: ${found} found`)
        }
      }

      log('step', `✓ Done — ${allLeads.length} leads ready`)
      if (allFlagged.length > 0) log('flag', `⚑ ${allFlagged.length} row(s) flagged — see the ⚑ column in the table`)

      setLeads([...allLeads])
      setFlagged([...allFlagged])
      setAuditEntries([...allAudit])
      setPhase('done')
      setActiveTab('results')
    } catch (err) {
      log('err', `Error: ${(err as Error).message}`)
      setPhase('done')
    }
    setBusy(false)
  }

  // ── Lead update ───────────────────────────────────────────────────────────
  function updateLead(key: string, field: string, value: string) {
    setLeads(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  function dismissFlag(key: string) {
    setFlagged(prev => prev.filter(f => !(f.keys || []).includes(key)))
    const l = leads.find(x => x._key === key)
    setAuditEntries(prev => [...prev, { type: 'field_map', detail: `Flag dismissed: ${l ? l.first_name + ' ' + l.last_name : key}`, ts: Date.now() }])
  }

  function deleteLead(key: string) {
    const l = leads.find(x => x._key === key)
    setLeads(prev => prev.filter(x => x._key !== key))
    setAuditEntries(prev => [...prev, { type: 'field_map', detail: `Deleted: ${l ? l.first_name + ' ' + l.last_name + ' (' + l.company + ')' : key}`, ts: Date.now() }])
  }

  // ── Download CSV ──────────────────────────────────────────────────────────
  function downloadCSV() {
    const cols = ['First Name', 'Last Name', 'Job Title', 'Email', 'Company', 'Campaign Status', 'SF Campaign ID', 'Assigned To Email', 'Notes']
    const rows = leads.map(l => [l.first_name, l.last_name, l.job_title || '', l.email || '', l.company || '', l.campaign_status || '', l.sf_campaign_id || '', l.assigned_to_email || '', l.notes_summary || l.all_notes?.filter(Boolean).join(' | ') || ''].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    const url = URL.createObjectURL(new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `leads_${(eventName || 'event').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Trigger n8n ───────────────────────────────────────────────────────────
  async function triggerN8N() {
    setN8nBusy(true); setN8nResult({ phase: 'pending' })
    const cols = ['First Name', 'Last Name', 'Job Title', 'Email', 'Company', 'Campaign Status', 'SF Campaign ID', 'Assigned To Email', 'Notes']
    const rows = leads.map(l => [l.first_name, l.last_name, l.job_title || '', l.email || '', l.company || '', l.campaign_status || '', l.sf_campaign_id || '', l.assigned_to_email || '', l.notes_summary || l.all_notes?.filter(Boolean).join(' | ') || ''].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    const lead_list_csv_string = [cols.join(','), ...rows].join('\n')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)
      const res = await fetch('/api/event-leads/trigger', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: eventName, lead_list_csv_string, lead_count: leads.length }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setN8nResult({ phase: 'success', data })
    } catch (e) {
      const msg = (e as Error).name === 'AbortError'
        ? 'Request timed out after 90 seconds — the workflow may still be running. Check n8n and HubSpot directly.'
        : (e as Error).message
      setN8nResult({ phase: 'error', error: msg })
    }
    setN8nBusy(false)
  }

  // ── Layout constants ──────────────────────────────────────────────────────
  const hi = leads.filter(l => ['Demo Interest (MQL)', 'Expansion Interest (CMQL)'].includes(l.campaign_status)).length
  const we = leads.filter(l => l.email).length

  // ── Audit log render ──────────────────────────────────────────────────────
  const AUDIT_ICON: Record<string, string> = { merge: '⟳', flag: '⚑', normalise: '↻', field_map: '⊞', warning: '⚠' }
  const AUDIT_BG: Record<string, string> = { merge: '#fff7ed', flag: '#fffbeb', normalise: '#eff6ff', field_map: '#eff6ff', warning: '#fffbeb' }
  const AUDIT_COLOR: Record<string, string> = { merge: 'var(--orange-700)', flag: 'var(--amber-700)', normalise: 'var(--blue-600)', field_map: 'var(--blue-600)', warning: 'var(--amber-700)' }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: '-32px -40px -64px', height: 'calc(100vh - 56px)', display: 'flex', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }`}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width: 300, flexShrink: 0, background: 'var(--bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Import section */}
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>Import</div>

          {/* Source toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['notion', 'csv'] as ImportSource[]).map(src => (
              <button key={src} onClick={() => switchSource(src)} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: importSource === src ? '#fff7ed' : 'var(--bg)', color: importSource === src ? 'var(--orange-700)' : 'var(--fg-3)', fontFamily: 'inherit', transition: 'all .15s' }}>
                {src === 'notion' ? 'Notion URL' : 'CSV upload'}
              </button>
            ))}
          </div>

          {/* Notion source */}
          {importSource === 'notion' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 7, lineHeight: 1.6 }}>Paste your Notion campaign page URL below and click Fetch.</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={notionUrl}
                  onChange={e => setNotionUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && notionUrl && !notionFetching && fetchNotion()}
                  placeholder="https://www.notion.so/Event-Name-32d6…"
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 12, color: 'var(--fg-1)', fontFamily: 'inherit', outline: 'none' }}
                />
                <button
                  onClick={fetchNotion}
                  disabled={!notionUrl.trim() || notionFetching}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: !notionUrl.trim() || notionFetching ? 'not-allowed' : 'pointer', border: 'none', background: !notionUrl.trim() || notionFetching ? 'var(--border)' : 'var(--blue-500)', color: !notionUrl.trim() || notionFetching ? 'var(--fg-3)' : '#fff', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                >
                  {notionFetching ? '…' : 'Fetch'}
                </button>
              </div>
              {notionStatus.msg && (
                <div style={{ fontSize: 11, color: notionStatus.type === 'ok' ? 'var(--green-700)' : notionStatus.type === 'err' ? 'var(--red-600)' : 'var(--fg-3)' }}>{notionStatus.msg}</div>
              )}
            </div>
          )}

          {/* CSV source */}
          {importSource === 'csv' && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 5 }}>Import name</div>
                <input value={csvName} onChange={e => setCsvName(e.target.value)} placeholder="e.g. ATLIS 2025" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: 'var(--fg-1)', fontFamily: 'inherit', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 5 }}>Salesforce Campaign ID</div>
                <input value={sfCampaignId} onChange={e => setSfCampaignId(e.target.value)} placeholder="e.g. 701Q900001RI71OIAT" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: 'var(--fg-1)', fontFamily: 'inherit', outline: 'none' }} />
              </div>
              {!csvFilename ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{ border: '1.5px dashed var(--border)', borderRadius: 8, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)', position: 'relative' }}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  <div style={{ width: 34, height: 34, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: 'var(--blue-500)', fontSize: 15 }}>↑</div>
                  <div style={{ color: 'var(--fg-3)', fontSize: 12, lineHeight: 1.6 }}><strong style={{ color: 'var(--fg-1)' }}>Drop CSV here</strong> or click to browse</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <span style={{ color: 'var(--green-700)' }}>✓</span>
                  <span style={{ flex: 1, color: 'var(--green-700)', fontWeight: 600, fontSize: 12 }}>{csvFilename}</span>
                  <span onClick={removeFile} style={{ color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14 }}>✕</span>
                </div>
              )}
            </div>
          )}

          {/* Run button */}
          <button
            onClick={startProcessing}
            disabled={!runReady || busy}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !runReady || busy ? 'not-allowed' : 'pointer', border: 'none', background: !runReady || busy ? 'var(--border)' : 'var(--blue-500)', color: !runReady || busy ? 'var(--fg-3)' : '#fff', fontFamily: 'inherit', transition: 'all .15s' }}
          >
            {busy ? <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .65s linear infinite', display: 'inline-block' }} /> : '⚡'}
            {busy ? 'Processing…' : phase === 'done' ? 'Re-run agent' : 'Run agent'}
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

          {/* Status priority legend */}
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', marginBottom: 10 }}>Status priority</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STATUS_PRIORITY.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ width: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 10, fontWeight: 700 }}>{s.rank}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, border: `1px solid ${s.style.border}`, background: s.style.bg, color: s.style.color }}>{s.label}</span>
                {i === 0 && <span style={{ color: 'var(--fg-3)', fontSize: 10, marginLeft: 'auto' }}>highest</span>}
                {i === STATUS_PRIORITY.length - 1 && <span style={{ color: 'var(--fg-3)', fontSize: 10, marginLeft: 'auto' }}>lowest</span>}
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

          {/* Pipeline description */}
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', marginBottom: 10 }}>Pipeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              { n: 1, title: 'Parse + normalise', desc: 'Column detection, name splitting, status mapping, fuzzy dedup', color: undefined },
              { n: 2, title: 'Notes summary', desc: 'AI consolidated summary per contact', color: undefined },
              { n: 3, title: 'Email waterfall', desc: 'Web research → domain guess', color: 'var(--blue-600)' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginTop: 1 }}>{step.n}</span>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: step.color ?? 'var(--fg-1)' }}>{step.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Content area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar — only when done */}
        {phase === 'done' && !n8nResult && (
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', padding: '0 20px', flexShrink: 0 }}>
            {(['results', 'audit'] as ActiveTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '14px 16px 12px', fontSize: 12, fontWeight: 600, color: activeTab === tab ? 'var(--blue-500)' : 'var(--fg-3)', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--blue-500)' : '2px solid transparent', marginBottom: -1, background: 'none', border: 'none', fontFamily: 'inherit', transition: 'all .15s' }}>
                {tab === 'results' ? 'Results' : 'Audit log'}
                {tab === 'results' && leads.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff7ed', color: 'var(--orange-700)', border: '1px solid #fed7aa', borderRadius: 10, fontSize: 10, fontWeight: 700, minWidth: 18, height: 16, padding: '0 5px', marginLeft: 5 }}>{leads.length}</span>}
                {tab === 'audit' && auditEntries.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff7ed', color: 'var(--orange-700)', border: '1px solid #fed7aa', borderRadius: 10, fontSize: 10, fontWeight: 700, minWidth: 18, height: 16, padding: '0 5px', marginLeft: 5 }}>{auditEntries.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* n8n flow */}
          {n8nResult && (
            <div style={{ maxWidth: 520, margin: '40px auto' }}>
              {n8nResult.phase === 'pending' && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--blue-500)', borderRadius: '50%', animation: 'spin .65s linear infinite' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)', marginBottom: 4 }}>Workflow running…</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''} · {eventName || 'Unnamed import'}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.7 }}>Creating HubSpot lists, updating contacts, triggering workflows and updating Salesforce campaign members.<br /><br />This usually takes <strong>30–60 seconds</strong> — please don't close this tab.</div>
                </div>
              )}
              {n8nResult.phase === 'success' && (() => {
                const d = n8nResult.data || {}
                const listId = d.hubspot_list_id as string | undefined
                const sfId = leads[0]?.sf_campaign_id || ''
                const listUrl = listId
                  ? `https://app.hubspot.com/contacts/20549138/objectLists/${listId}/filters`
                  : `https://app.hubspot.com/contacts/20549138/objectLists?query=${encodeURIComponent(eventName)}`
                return (
                  <div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 32, height: 32, background: 'var(--green-700)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>✓</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green-700)' }}>Import completed successfully</div>
                          <div style={{ fontSize: 11.5, color: 'var(--green-700)', opacity: .8 }}>{leads.length} lead{leads.length !== 1 ? 's' : ''} · {eventName || 'Unnamed import'}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>HubSpot list</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14, lineHeight: 1.6 }}>A new HubSpot list named <strong style={{ color: 'var(--fg-1)' }}>{eventName}</strong> has been created for all imported contacts.</div>
                      <a href={listUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--blue-500)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>{listId ? 'Open HubSpot list →' : 'Search for list in HubSpot →'}</a>
                    </div>
                    {sfId && (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Salesforce campaign</div>
                        <a href={`https://orah.lightning.force.com/lightning/r/Campaign/${sfId}/view`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--blue-500)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Open Salesforce campaign →</a>
                      </div>
                    )}
                    {typeof d.n8n_execution_url === 'string' && <div style={{ marginTop: 12, textAlign: 'center' }}><a href={d.n8n_execution_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--fg-3)', textDecoration: 'underline' }}>View n8n execution log</a></div>}
                    <button onClick={() => setN8nResult(null)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-1)', fontFamily: 'inherit' }}>← Back to results</button>
                  </div>
                )
              })()}
              {n8nResult.phase === 'error' && (
                <div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, background: 'var(--red-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>✕</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red-600)' }}>Import failed</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.7 }}>{n8nResult.error}</div>
                  </div>
                  <button onClick={() => setN8nResult(null)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-1)', fontFamily: 'inherit' }}>← Try again</button>
                </div>
              )}
            </div>
          )}

          {/* Processing / agent log */}
          {!n8nResult && phase === 'processing' && (
            <div style={{ background: 'var(--navy-900)', borderRadius: 10, padding: 16, fontFamily: "'Courier New', monospace", fontSize: 11.5, color: 'rgba(255,255,255,0.8)', lineHeight: 2, maxHeight: 420, overflowY: 'auto' }} ref={logRef}>
              {logLines.map((line, i) => (
                <div key={i}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{new Date(line.ts).toTimeString().slice(0, 8)}</span>{' '}
                  <span style={{ color: LOG_COLOR[line.type] || 'rgba(255,255,255,0.55)' }}>{line.msg}</span>
                  {i === logLines.length - 1 && <span style={{ display: 'inline-block', width: 7, height: 12, background: '#4ade80', animation: 'blink 1s infinite', verticalAlign: 'middle', marginLeft: 2 }} />}
                </div>
              ))}
              {logLines.length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)' }}>Agent starting…</div>}
            </div>
          )}

          {/* Upload empty state */}
          {!n8nResult && phase === 'upload' && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--fg-3)' }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: .4 }}>◫</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-2)', marginBottom: 4 }}>No leads processed yet</div>
              <div style={{ fontSize: 12 }}>Fetch a Notion page or upload a CSV, then click Run agent</div>
            </div>
          )}

          {/* Done — show log first, then switch to tabs */}
          {!n8nResult && phase === 'done' && logLines.length > 0 && activeTab === 'results' && leads.length === 0 && (
            <div style={{ background: 'var(--navy-900)', borderRadius: 10, padding: 16, fontFamily: "'Courier New', monospace", fontSize: 11.5, color: 'rgba(255,255,255,0.8)', lineHeight: 2, maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {logLines.map((line, i) => (
                <div key={i}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{new Date(line.ts).toTimeString().slice(0, 8)}</span>{' '}
                  <span style={{ color: LOG_COLOR[line.type] || 'rgba(255,255,255,0.55)' }}>{line.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Results tab */}
          {!n8nResult && phase === 'done' && activeTab === 'results' && leads.length > 0 && (
            <LeadTable
              leads={leads}
              flagged={flagged}
              eventName={eventName}
              onEventNameChange={setEventName}
              onUpdate={updateLead}
              onDismissFlag={dismissFlag}
              onDelete={deleteLead}
            />
          )}

          {/* Audit tab */}
          {!n8nResult && phase === 'done' && activeTab === 'audit' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>Every decision made by the agent.</div>
              {auditEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--fg-3)' }}>No audit entries yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {auditEntries.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, marginTop: 1, background: AUDIT_BG[a.type] || '#eff6ff', color: AUDIT_COLOR[a.type] || 'var(--blue-600)' }}>{AUDIT_ICON[a.type] || 'i'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 1 }}>
                          {(a.type || '').replace(/_/g, ' ')}
                          <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginLeft: 6 }}>{new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <div style={{ color: 'var(--fg-3)', lineHeight: 1.5 }}>{a.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer bar */}
        {phase === 'done' && !n8nResult && leads.length > 0 && (
          <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 16, flex: 1, fontSize: 12, color: 'var(--fg-3)' }}>
              <span><strong style={{ color: 'var(--fg-1)' }}>{leads.length}</strong> leads</span>
              <span><strong style={{ color: 'var(--fg-1)' }}>{hi}</strong> high intent</span>
              <span><strong style={{ color: 'var(--fg-1)' }}>{we}</strong> with email</span>
              <span><strong style={{ color: 'var(--fg-1)' }}>{leads.length - we}</strong> missing email</span>
            </div>
            <button onClick={downloadCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-1)', fontFamily: 'inherit' }}>↓ Download CSV</button>
            <button onClick={triggerN8N} disabled={n8nBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: n8nBusy ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--blue-500)', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {n8nBusy && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .65s linear infinite', display: 'inline-block' }} />}
              Trigger import via n8n →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
