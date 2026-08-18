'use client'

import { useState } from 'react'

interface Props {
  label: string
  allLabel: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
}

export default function MultiSelectFilter({ label, allLabel, options, selected, onToggle, onClear }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 34, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Open Sans', sans-serif",
          fontSize: 14, border: `1px solid ${selected.length ? '#0073E6' : '#E0E0E0'}`,
          background: selected.length ? '#e6f1fd' : '#fff', color: selected.length ? '#003F7F' : '#262626',
        }}
      >
        {selected.length ? `${label} · ${selected.length}` : allLabel}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 38, left: 0, zIndex: 40, width: 230, maxHeight: 280, overflowY: 'auto',
          background: '#fff', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
          boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
        }}>
          {options.map(o => {
            const on = selected.includes(o)
            return (
              <button
                key={o}
                onClick={() => onToggle(o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '7px 8px',
                  border: 'none', borderRadius: 6, background: on ? '#e6f1fd' : 'transparent',
                  color: 'rgba(0,0,0,0.87)', fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 15, height: 15, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10, color: '#fff',
                  border: `1px solid ${on ? '#0073E6' : '#BDBDBD'}`, background: on ? '#0073E6' : '#fff',
                }}>
                  {on ? '✓' : ''}
                </span>
                <span>{o}</span>
              </button>
            )
          })}
          <button
            onClick={() => { onClear(); setOpen(false) }}
            style={{
              marginTop: 2, textAlign: 'left', padding: '7px 8px', border: 'none',
              borderTop: '1px solid rgba(0,0,0,0.09)', borderRadius: '0 0 6px 6px', background: 'transparent',
              color: '#0073E6', fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Clear {label} Filter
          </button>
        </div>
      )}
    </div>
  )
}
