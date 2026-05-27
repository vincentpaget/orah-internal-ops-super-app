'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FLAG_SHORT_LABELS } from '@/lib/csHygiene'

interface Props {
  flags: string[]
}

export default function FlagsCell({ flags }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  if (flags.length === 0) return <span style={{ color: 'var(--fg-3)' }}>—</span>

  function handleMouseEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: r.top })
      setOpen(true)
    }
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setOpen(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 4,
          background: 'rgba(245,158,11,0.12)', color: '#92400e',
          fontWeight: 700, fontSize: 13, cursor: 'default',
          whiteSpace: 'nowrap', userSelect: 'none',
        }}
      >
        ⚑ {flags.length}
      </span>

      {open && pos && createPortal(
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y - 8,
          transform: 'translate(-50%, -100%)',
          zIndex: 9999,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
          padding: '10px 14px',
          minWidth: 190,
          pointerEvents: 'none',
          fontFamily: 'var(--font-sans)',
        }}>
          <div style={{
            fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8,
            fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            Deal warnings
          </div>
          {flags.map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 4, fontSize: 13, color: 'var(--fg-2)',
              lineHeight: '18px',
            }}>
              <span style={{ color: '#d97706', fontSize: 8, lineHeight: '13px', flexShrink: 0 }}>●</span>
              {FLAG_SHORT_LABELS[f] ?? f}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
