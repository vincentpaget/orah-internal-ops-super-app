'use client'

import { useState } from 'react'
import type { EnrichedOpportunity, MeddiccKey, ModalFormState } from '@/lib/sql-handoff/types'
import { MEDDICC_FIELDS, buildMeddiccForm, changedMeddicc, isSqoCriteriaMet } from '@/lib/sql-handoff/logic'
import MeddiccGrid from './MeddiccGrid'

interface Props {
  target: EnrichedOpportunity
  /** Resolves true when Salesforce accepted the change */
  onSave: (target: EnrichedOpportunity, meddicc: ModalFormState['meddicc']) => Promise<boolean>
  onClose: () => void
}

const BTN = { height: 38, padding: '0 16px', borderRadius: 6, fontFamily: "'Open Sans', sans-serif", fontSize: 14, fontWeight: 600 } as const

// Opened from the MEDDICC traffic lights in the pipeline table: view and edit grades and rep notes only.
export default function MeddiccModal({ target, onSave, onClose }: Props) {
  const [meddicc, setMeddicc] = useState(() => buildMeddiccForm(target))
  const [saving, setSaving] = useState(false)
  const dirty = Object.keys(changedMeddicc(target, meddicc)).length > 0

  // SQO status as it would be after saving
  const preview = { ...target }
  MEDDICC_FIELDS.forEach(m => { (preview as Record<string, unknown>)[m.gradeField] = meddicc[m.key].grade || null })
  const sqoMet = isSqoCriteriaMet(preview)

  function update(key: MeddiccKey, patch: Partial<{ grade: string; notes: string }>) {
    setMeddicc(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function save() {
    if (!dirty) { onClose(); return }
    setSaving(true)
    const ok = await onSave(target, meddicc)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}
    >
      <div style={{ background: '#fff', borderRadius: 10, width: 900, maxWidth: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Open Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid rgba(0,0,0,0.09)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#262626' }}>{target.Name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }}>MEDDICC</span>
          </div>
          <span style={{
            flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 100,
            background: sqoMet ? '#E8F5E9' : '#FDECEC', color: sqoMet ? '#2E7D32' : '#D32F2F',
          }}>
            {sqoMet ? 'SQO criteria met' : 'SQO criteria not met'}
          </span>
        </div>

        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.54)', marginTop: -8 }}>
          SQO criteria: Identified Pain, Economic Buyer and Compelling Event all Yellow or Green.
        </span>

        <MeddiccGrid
          keys={MEDDICC_FIELDS.map(m => m.key)} target={target} meddicc={meddicc}
          gated={false} showErrors={false} onChange={update}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(0,0,0,0.09)', paddingTop: 14 }}>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} disabled={saving} style={{ ...BTN, border: '1px solid #E0E0E0', background: '#fff', color: '#434343', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={save} disabled={saving || !dirty}
            style={{ ...BTN, border: 'none', background: '#0073E6', color: '#fff', fontWeight: 700, cursor: saving || !dirty ? 'default' : 'pointer', opacity: saving || !dirty ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save & Sync To Salesforce'}
          </button>
        </div>
      </div>
    </div>
  )
}
