'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  SFSqlHandoffOpportunity, SFSqlDashboardRecord, ModalState, ModalKind, TabKey, WarningKey, MeddiccKey,
} from '@/lib/sql-handoff/types'
import {
  enrichOpportunity, matchTab, buildMatrix, computeStageCounts, computeWarningsSummary,
  computeDashboardMetrics, buildModalForm, isModalBlocked, TAB_DEFAULT_SORT, MEDDICC_FIELDS,
} from '@/lib/sql-handoff/logic'
import PipelineView from './PipelineView'
import DashboardView from './DashboardView'
import OpportunityModal from './OpportunityModal'
import Toast from './Toast'

interface Props {
  opportunities: SFSqlHandoffOpportunity[]
  history: SFSqlDashboardRecord[]
}

function navStyle(active: boolean): CSSProperties {
  return {
    border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px 10px', marginBottom: -1,
    fontFamily: "'Open Sans', sans-serif", fontSize: 14, fontWeight: 600,
    color: active ? '#0073E6' : 'rgba(0,0,0,0.54)', borderBottom: `2px solid ${active ? '#0073E6' : 'transparent'}`,
  }
}

function applyMeddiccToOpp(opp: SFSqlHandoffOpportunity, meddicc: ModalState['form']['meddicc']): SFSqlHandoffOpportunity {
  const next = { ...opp }
  MEDDICC_FIELDS.forEach(m => {
    const entry = meddicc[m.key]
    ;(next as Record<string, unknown>)[m.gradeField] = entry.grade
    ;(next as Record<string, unknown>)[m.notesField] = entry.notes || null
  })
  return next
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to save')
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16" fill="none"
      style={spinning ? { animation: 'sql-handoff-spin 900ms linear infinite' } : undefined}
    >
      <path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 3.5v3.2h-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SqlHandoffApp({ opportunities, history: initialHistory }: Props) {
  const [items, setItems] = useState(opportunities)
  const [history, setHistory] = useState(initialHistory)
  const [syncing, setSyncing] = useState(false)
  const [nav, setNav] = useState<'pipe' | 'dash'>('pipe')
  const [tab, setTab] = useState<TabKey>('held')
  const [query, setQuery] = useState('')
  const [ownerSel, setOwnerSel] = useState<string[]>([])
  const [rtypeSel, setRtypeSel] = useState<string[]>([])
  const [creatorSel, setCreatorSel] = useState<string[]>([])
  const [warnSel, setWarnSel] = useState<WarningKey[]>([])
  const [sortKey, setSortKey] = useState(TAB_DEFAULT_SORT.held.key)
  const [sortDir, setSortDir] = useState<1 | -1>(TAB_DEFAULT_SORT.held.dir)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const enriched = useMemo(() => items.map(enrichOpportunity), [items])

  const ownerOptions = useMemo(() => Array.from(new Set(enriched.map(c => c['Owner.Name']))).sort(), [enriched])
  const rtypeOptions = useMemo(() => Array.from(new Set(enriched.map(c => c.Record_Type_Name__c).filter((v): v is string => !!v))).sort(), [enriched])
  const creatorOptions = useMemo(() => Array.from(new Set(enriched.map(c => c['CreatedBy.Name']))).sort(), [enriched])

  const scoped = useMemo(() => enriched.filter(c =>
    (ownerSel.length === 0 || ownerSel.includes(c['Owner.Name'])) &&
    (rtypeSel.length === 0 || (c.Record_Type_Name__c != null && rtypeSel.includes(c.Record_Type_Name__c))) &&
    (creatorSel.length === 0 || creatorSel.includes(c['CreatedBy.Name']))
  ), [enriched, ownerSel, rtypeSel, creatorSel])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return scoped.filter(c => {
      if (q && !c.Name.toLowerCase().includes(q) && !c['Owner.Name'].toLowerCase().includes(q)) return false
      if (warnSel.length && !warnSel.some(k => c.warnKeys.includes(k))) return false
      return true
    })
  }, [scoped, query, warnSel])

  const rowsForTab = useMemo(() => filtered.filter(c => matchTab(c, tab)), [filtered, tab])

  const dashboardMetrics = useMemo(() => computeDashboardMetrics(history, ownerSel), [history, ownerSel])
  const stageCounts = useMemo(() => computeStageCounts(scoped), [scoped])
  const warningsSummary = useMemo(() => computeWarningsSummary(scoped), [scoped])
  const wTotal = useMemo(() => scoped.filter(c => c.warnCount > 0).length, [scoped])
  const ownerMatrix = useMemo(() => buildMatrix(scoped, 'Owner.Name'), [scoped])
  const creatorMatrix = useMemo(() => buildMatrix(scoped, 'CreatedBy.Name'), [scoped])

  function handleSort(key: string) {
    if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  function handleTabChange(key: TabKey) {
    setTab(key)
    const def = TAB_DEFAULT_SORT[key]
    setSortKey(def.key)
    setSortDir(def.dir)
  }

  function toggleWarn(key: WarningKey) {
    setWarnSel(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  function toggleSel(setter: (fn: (prev: string[]) => string[]) => void, value: string) {
    setter(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }

  function openModal(kind: ModalKind, card: (typeof enriched)[number]) {
    setModal({ kind, target: card, form: buildModalForm(card) })
    setShowErrors(false)
  }

  function closeModal() {
    setModal(null)
    setShowErrors(false)
  }

  function updateField(key: keyof ModalState['form'], value: string) {
    setModal(prev => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev))
  }

  function updateMeddicc(key: MeddiccKey, patch: Partial<{ grade: string; notes: string }>) {
    setModal(prev => {
      if (!prev) return prev
      const entry = prev.form.meddicc[key]
      return {
        ...prev,
        form: { ...prev.form, meddicc: { ...prev.form.meddicc, [key]: { ...entry, ...patch } } },
      }
    })
  }

  async function confirmModal() {
    if (!modal) return
    if (isModalBlocked(modal.kind, modal.form)) {
      setShowErrors(true)
      return
    }
    const { kind, target, form } = modal
    const namePrefix = target.Name.split(' - ')[0]
    setSaving(true)
    try {
      if (kind === 'edit') {
        await postJson('/api/sql-handoff/quick-edit', {
          opportunityId: target.Id, closeDate: form.closeDate || null,
          amount: form.amount === '' ? null : Number(form.amount), nextStep: form.nextStep || null, outcome: form.outcome || null,
          managerReviewNotes: form.managerReviewNotes || null, fup: form.fup || null,
          discoveryNotes: form.discoveryNotes || null, meddicc: form.meddicc,
        })
        setItems(prev => prev.map(i => (i.Id === target.Id ? applyMeddiccToOpp({
          ...i, CloseDate: form.closeDate || null, Amount: form.amount === '' ? null : Number(form.amount),
          NextStep: form.nextStep || null, Initial_Meeting_Outcome__c: (form.outcome || null) as typeof i.Initial_Meeting_Outcome__c,
          Manager_Review_Notes__c: form.managerReviewNotes || null,
          Initial_Meeting_FUp_Email_Status__c: (form.fup || null) as typeof i.Initial_Meeting_FUp_Email_Status__c,
          Discovery_Notes__c: form.discoveryNotes || null,
        }, form.meddicc) : i)))
        setToast(`${namePrefix} updated`)
      } else if (kind === 'qualify') {
        await postJson('/api/sql-handoff/move-to-evaluation', {
          opportunityId: target.Id, closeDate: form.closeDate, amount: Number(form.amount), nextStep: form.nextStep || null,
          meddicc: form.meddicc,
        })
        setItems(prev => prev.filter(i => i.Id !== target.Id))
        setToast(`${namePrefix} moved to Evaluation`)
      } else if (kind === 'nurture') {
        await postJson('/api/sql-handoff/move-to-nurturing', {
          opportunityId: target.Id, closeDate: form.closeDate, amount: Number(form.amount),
          nextStep: form.nextStep || null, reengage: form.reengage, nurtureReason: form.nurtureReason, meddicc: form.meddicc,
        })
        setItems(prev => prev.filter(i => i.Id !== target.Id))
        setToast(`${namePrefix} moved to Nurture`)
      } else if (kind === 'dq') {
        await postJson('/api/sql-handoff/close-disqualified', {
          opportunityId: target.Id, lossReasonLabel: form.lossReasonLabel, lossDetail: form.lossDetail, nextStep: form.nextStep,
        })
        setItems(prev => prev.filter(i => i.Id !== target.Id))
        setToast(`${namePrefix} closed as Disqualified · ${form.lossReasonLabel}`)
      }
      setModal(null)
      setShowErrors(false)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleResync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sql-handoff/resync')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to resync')
      setItems(data.opportunities)
      setHistory(data.history)
      setToast(`Synced ${data.opportunities.length} open opportunities from Salesforce`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to resync with Salesforce')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ fontFamily: "'Open Sans', sans-serif" }}>
      <style>{'@keyframes sql-handoff-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#262626', lineHeight: 1.3 }}>SQL Handoff</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(0,0,0,0.66)', lineHeight: '20px' }}>
              Every open opportunity in Qualifying. Hold the demo, disposition it, then qualify into pipeline or close it out.
            </p>
          </div>
          <button
            onClick={handleResync}
            disabled={syncing}
            style={{
              flexShrink: 0, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 34, padding: '0 14px', borderRadius: 6, border: '1px solid #E0E0E0', background: '#fff',
              color: '#262626', fontFamily: "'Open Sans', sans-serif", fontSize: 13, fontWeight: 600,
              cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.7 : 1,
            }}
          >
            <RefreshIcon spinning={syncing} />
            {syncing ? 'Syncing…' : 'Resync Salesforce'}
          </button>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 24, borderBottom: '1px solid rgba(0,0,0,0.09)' }}>
          <button onClick={() => setNav('pipe')} style={navStyle(nav === 'pipe')}>SQL Pipeline</button>
          <button onClick={() => setNav('dash')} style={navStyle(nav === 'dash')}>Dashboard</button>
        </div>
      </div>

      {nav === 'pipe' && (
        <PipelineView
          scoped={scoped} filtered={filtered} rowsForTab={rowsForTab}
          query={query} onQueryChange={setQuery}
          ownerSel={ownerSel} onToggleOwner={v => toggleSel(setOwnerSel, v)} onClearOwner={() => setOwnerSel([])} ownerOptions={ownerOptions}
          rtypeSel={rtypeSel} onToggleRtype={v => toggleSel(setRtypeSel, v)} onClearRtype={() => setRtypeSel([])} rtypeOptions={rtypeOptions}
          creatorSel={creatorSel} onToggleCreator={v => toggleSel(setCreatorSel, v)} onClearCreator={() => setCreatorSel([])} creatorOptions={creatorOptions}
          warnSel={warnSel} onToggleWarn={toggleWarn} onClearWarn={() => setWarnSel([])}
          tab={tab} onTabChange={handleTabChange}
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          onAction={openModal}
        />
      )}

      {nav === 'dash' && (
        <DashboardView
          metrics={dashboardMetrics} stageCounts={stageCounts} warningsSummary={warningsSummary} wTotal={wTotal}
          ownerMatrix={ownerMatrix} creatorMatrix={creatorMatrix} onStageClick={handleTabChange}
        />
      )}

      {modal && (
        <OpportunityModal
          kind={modal.kind} target={modal.target} form={modal.form} showErrors={showErrors} saving={saving}
          onFieldChange={updateField} onMeddiccChange={updateMeddicc} onCancel={closeModal} onConfirm={confirmModal}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
