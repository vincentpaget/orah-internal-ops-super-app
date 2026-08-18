'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { EnrichedOpportunity, ModalFieldSpec, ModalFormState, ModalKind, MeddiccKey } from '@/lib/sql-handoff/types'
import {
  MEDDICC_FIELDS, gradeColors, isModalBlocked, buildModalFields, buildModalRequirements, meddiccKeysForKind,
} from '@/lib/sql-handoff/logic'
import GradingGuideIcon from './GradingGuideIcon'

interface Props {
  kind: ModalKind
  target: EnrichedOpportunity
  form: ModalFormState
  showErrors: boolean
  saving: boolean
  onFieldChange: (key: keyof ModalFormState, value: string) => void
  onMeddiccChange: (key: MeddiccKey, patch: Partial<{ grade: string; notes: string }>) => void
  onCancel: () => void
  onConfirm: () => void
}

const CTRL: CSSProperties = {
  height: 36, padding: '0 10px', fontFamily: "'Open Sans', sans-serif", fontSize: 14, color: '#262626',
  background: '#fff', border: '1px solid #E0E0E0', borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box',
}
const AREA: CSSProperties = { ...CTRL, height: 'auto', padding: '8px 10px', resize: 'vertical' }
const LABEL: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.66)', display: 'flex', gap: 4 }
const ERROR: CSSProperties = { fontSize: 12, color: '#D32F2F' }
const SECTION_TITLE: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E', borderBottom: '1px solid rgba(0,0,0,0.09)', paddingBottom: 8 }
const COL_HEAD: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }
const RO_BOX: CSSProperties = { minHeight: 36, padding: '8px 10px', display: 'flex', alignItems: 'center', fontSize: 13, lineHeight: '18px', color: 'rgba(0,0,0,0.66)', background: '#F5F5F5', border: '1px solid #EEEEEE', borderRadius: 6, boxSizing: 'border-box', whiteSpace: 'pre-wrap' }

function errClass(hasError: boolean, showErrors: boolean): CSSProperties {
  return hasError && showErrors ? { borderColor: '#D32F2F' } : {}
}

const TITLES: Record<ModalKind, { title: string; label: string; color: string }> = {
  edit: { title: 'Quick Edit', label: 'Save & Sync To Salesforce', color: '#0073E6' },
  qualify: { title: 'Move To Evaluation', label: 'Move To Evaluation', color: '#2E7D32' },
  nurture: { title: 'Move To Nurture', label: 'Move To Nurture', color: '#F57C00' },
  dq: { title: 'Closed - Disqualified', label: 'Close As Disqualified', color: '#D32F2F' },
}

function renderField(field: ModalFieldSpec, showErrors: boolean, onFieldChange: Props['onFieldChange']): ReactNode {
  const gridColumn = `span ${Math.round(field.span * 2)}`
  const showError = !!field.error && showErrors
  const formKey = field.key as keyof ModalFormState

  let control: ReactNode
  if (field.kind === 'ro') {
    control = <div style={RO_BOX}>{field.value || '—'}</div>
  } else if (field.kind === 'select') {
    control = (
      <select value={field.value} onChange={e => onFieldChange(formKey, e.target.value)} style={{ ...CTRL, ...errClass(showError, showErrors) }}>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  } else if (field.kind === 'area') {
    control = (
      <textarea
        value={field.value} rows={2} placeholder={field.placeholder}
        onChange={e => onFieldChange(formKey, e.target.value)}
        style={{ ...AREA, ...errClass(showError, showErrors) }}
      />
    )
  } else {
    control = (
      <input
        type={field.kind} value={field.value} placeholder={field.placeholder}
        onChange={e => onFieldChange(formKey, e.target.value)}
        style={{ ...CTRL, ...errClass(showError, showErrors) }}
      />
    )
  }

  return (
    <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, gridColumn }}>
      <span style={LABEL}>
        <span>{field.label}</span>
        {field.required && <span style={{ color: '#D32F2F' }}>*</span>}
      </span>
      {control}
      {showError && <span style={ERROR}>{field.error}</span>}
    </div>
  )
}

export default function OpportunityModal({ kind, target, form, showErrors, saving, onFieldChange, onMeddiccChange, onCancel, onConfirm }: Props) {
  const isEdit = kind === 'edit'
  const showMeddicc = kind !== 'dq'
  const showKeyInfoTitle = kind !== 'dq'
  const blocked = isModalBlocked(kind, form)
  const { title, label, color } = TITLES[kind]
  const fields = buildModalFields(kind, target, form)
  const { title: reqTitle, items: reqItems } = buildModalRequirements(kind, form)
  const meddiccKeys = meddiccKeysForKind(kind)
  const gated = kind === 'qualify' || kind === 'nurture'
  const [meddiccOpen, setMeddiccOpen] = useState(!isEdit)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 10, width: isEdit ? 900 : 760, maxWidth: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Open Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid rgba(0,0,0,0.09)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#262626' }}>{target.Name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a
              href={target.sfUrl} target="_blank" rel="noopener noreferrer"
              style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', border: '1px solid #9CC9F5', borderRadius: 6, background: '#e6f1fd', color: '#003F7F', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              View in Salesforce
            </a>
            <a
              href={`https://app.gong.io/go/account?crm-id=${target.Id}&crm-object-type=opportunity`} target="_blank" rel="noopener noreferrer"
              style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', border: '1px solid #E0E0E0', borderRadius: 6, background: '#fff', color: '#434343', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              View in Gong
            </a>
          </div>
        </div>

        {!isEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FFF3E0', border: '1px solid #FFE0B2', borderRadius: 6, padding: '10px 12px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#B35C00' }}>{reqTitle}</span>
            {reqItems.map(r => (
              <span key={r.text} style={{ fontSize: 12, lineHeight: '17px', display: 'flex', gap: 6, color: r.ok ? '#2E7D32' : '#B35C00' }}>
                <span>{r.ok ? '✓' : '•'}</span><span>{r.text}</span>
              </span>
            ))}
          </div>
        )}

        {showKeyInfoTitle && <span style={SECTION_TITLE}>Key Info</span>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: '12px 16px' }}>
          {fields.map(f => renderField(f, showErrors, onFieldChange))}
        </div>

        {isEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={SECTION_TITLE}>AI Notes</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={LABEL}>AI Last Update</span>
                <div style={{ minHeight: 72, padding: '8px 10px', fontSize: 13, lineHeight: '18px', color: 'rgba(0,0,0,0.66)', background: '#F5F5F5', border: '1px solid #EEEEEE', borderRadius: 6, boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}>
                  {target.AI_Last_Update__c || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={LABEL}>AI Next Steps</span>
                <div style={{ minHeight: 72, padding: '8px 10px', fontSize: 13, lineHeight: '18px', color: 'rgba(0,0,0,0.66)', background: '#F5F5F5', border: '1px solid #EEEEEE', borderRadius: 6, boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}>
                  {target.AI_Next_Steps__c || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {showMeddicc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isEdit ? (
              <button
                onClick={() => setMeddiccOpen(o => !o)}
                style={{ ...SECTION_TITLE, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, paddingBottom: 8, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'Open Sans', sans-serif" }}
              >
                <span style={{ fontSize: 9, transition: 'transform 150ms', display: 'inline-block', transform: meddiccOpen ? 'none' : 'rotate(-90deg)' }}>▾</span>
                MEDDICC
              </button>
            ) : (
              <span style={SECTION_TITLE}>MEDDICC</span>
            )}
            {(!isEdit || meddiccOpen) && (
            <div style={{ display: 'grid', gridTemplateColumns: '170px 96px minmax(0,1fr) minmax(0,1fr)', gap: '10px 12px', alignItems: 'start' }}>
              <span style={COL_HEAD}>Element</span>
              <span style={COL_HEAD}>Grade</span>
              <span style={COL_HEAD}>Grade Reason</span>
              <span style={COL_HEAD}>Rep Notes</span>
              {meddiccKeys.map(key => {
                const m = MEDDICC_FIELDS.find(mf => mf.key === key)!
                const entry = form.meddicc[key]
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
                      onChange={e => onMeddiccChange(key, { grade: e.target.value })}
                      style={{
                        height: 34, padding: '0 8px', fontFamily: "'Open Sans', sans-serif", fontSize: 13, fontWeight: 600,
                        borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', background: tint.bg, color: tint.fg,
                        border: `1px solid ${err && showErrors ? '#D32F2F' : '#E0E0E0'}`,
                      }}
                    >
                      <option value="Red">Red</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Green">Green</option>
                    </select>
                    <div style={{ minHeight: 34, padding: '8px 9px', fontSize: 13, lineHeight: '17px', color: 'rgba(0,0,0,0.66)', background: '#F5F5F5', border: '1px solid #EEEEEE', borderRadius: 6, boxSizing: 'border-box' }}>
                      {reasonValue || '—'}
                    </div>
                    <textarea
                      value={entry.notes} rows={2} placeholder="Rep notes"
                      onChange={e => onMeddiccChange(key, { notes: e.target.value })}
                      style={{ padding: '7px 9px', fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: '#262626', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                )
              })}
            </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,0.09)', paddingTop: 14 }}>
          <span style={{ flex: 1, minWidth: 100, fontSize: 12, color: '#D32F2F' }}>
            {blocked && showErrors ? 'Fix the highlighted fields to continue.' : ''}
          </span>
          <button
            onClick={onCancel}
            style={{ height: 38, padding: '0 16px', border: '1px solid #E0E0E0', background: '#fff', color: '#434343', borderRadius: 6, fontFamily: "'Open Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              height: 38, padding: '0 16px', border: 'none', background: color, color: '#fff', borderRadius: 6,
              fontFamily: "'Open Sans', sans-serif", fontSize: 14, fontWeight: isEdit ? 700 : 600, cursor: saving ? 'default' : 'pointer',
              opacity: isEdit ? 1 : ((blocked && showErrors) || saving ? 0.6 : 1),
            }}
          >
            {saving ? 'Saving…' : label}
          </button>
        </div>
      </div>
    </div>
  )
}
