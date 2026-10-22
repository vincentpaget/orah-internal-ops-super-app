'use client'

import type { CSSProperties } from 'react'
import type { EnrichedOpportunity, MeddiccKey, ModalFormState } from '@/lib/sql-handoff/types'
import { MEDDICC_FIELDS, gradeColors } from '@/lib/sql-handoff/logic'
import GradingGuideIcon from './GradingGuideIcon'

interface Props {
  keys: MeddiccKey[]
  target: EnrichedOpportunity
  meddicc: ModalFormState['meddicc']
  /** Economic Buyer and Compelling Event must be at least Yellow (Move To Evaluation / Nurture) */
  gated: boolean
  showErrors: boolean
  onChange: (key: MeddiccKey, patch: Partial<{ grade: string; notes: string }>) => void
}

const COL_HEAD: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }

// MEDDICC grade grid: element, grade (editable), AI grade reason (read-only), rep notes (editable).
// Shared by the opportunity modal and the MEDDICC pop-up.
export default function MeddiccGrid({ keys, target, meddicc, gated, showErrors, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 96px minmax(0,1fr) minmax(0,1fr)', gap: '10px 12px', alignItems: 'start' }}>
      <span style={COL_HEAD}>Element</span>
      <span style={COL_HEAD}>Grade</span>
      <span style={COL_HEAD}>Grade Reason</span>
      <span style={COL_HEAD}>Rep Notes</span>
      {keys.map(key => {
        const m = MEDDICC_FIELDS.find(mf => mf.key === key)!
        const entry = meddicc[key]
        const isGatedRow = gated && (key === 'eb' || key === 'ce')
        const err = isGatedRow && entry.grade === 'Red'
        const tint = gradeColors(entry.grade)
        const reasonValue = target[m.reasonField] as string | null
        return (
          <div key={key} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', display: 'flex', gap: 5, alignItems: 'center' }}>
                <span>{m.label}</span>
                {isGatedRow && <span style={{ color: '#D32F2F' }}>*</span>}
                <GradingGuideIcon meddiccKey={key} label={m.label} />
              </span>
              {err && showErrors && <span style={{ fontSize: 11, color: '#D32F2F', lineHeight: '15px' }}>Must be at least Yellow to progress.</span>}
            </div>
            <select
              value={entry.grade}
              onChange={e => onChange(key, { grade: e.target.value })}
              style={{
                height: 34, padding: '0 8px', fontFamily: "'Open Sans', sans-serif", fontSize: 13, fontWeight: 600,
                borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', background: tint.bg, color: tint.fg,
                border: `1px solid ${err && showErrors ? '#D32F2F' : '#E0E0E0'}`,
              }}
            >
              {!entry.grade && <option value="">Not set</option>}
              <option value="Red">Red</option>
              <option value="Yellow">Yellow</option>
              <option value="Green">Green</option>
            </select>
            <div style={{ minHeight: 34, padding: '8px 9px', fontSize: 13, lineHeight: '17px', color: 'rgba(0,0,0,0.66)', background: '#F5F5F5', border: '1px solid #EEEEEE', borderRadius: 6, boxSizing: 'border-box' }}>
              {reasonValue || '—'}
            </div>
            <textarea
              value={entry.notes} rows={2} placeholder="Rep notes"
              onChange={e => onChange(key, { notes: e.target.value })}
              style={{ padding: '7px 9px', fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: '#262626', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        )
      })}
    </div>
  )
}
