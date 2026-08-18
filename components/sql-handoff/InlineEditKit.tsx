import type { CSSProperties } from 'react'

export function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.5 12.1l-2.8.6.6-2.8 7.98-8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: 'sql-handoff-spin 700ms linear infinite' }}>
      <path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export const ICON_BTN: CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 5, flexShrink: 0,
}

export const EDIT_FIELD: CSSProperties = {
  fontSize: 13, fontFamily: "'Open Sans', sans-serif", color: '#262626',
  border: '1px solid #0073E6', borderRadius: 6, padding: '5px 7px', width: '100%', boxSizing: 'border-box', background: '#fff',
}
export const EDIT_TEXTAREA: CSSProperties = { ...EDIT_FIELD, resize: 'vertical', minHeight: 56, lineHeight: '16px' }
