'use client'

import { useRef, useState } from 'react'
import type { EnrichedOpportunity, ModalKind } from '@/lib/sql-handoff/types'

interface Props {
  card: EnrichedOpportunity
  isHeld: boolean
  onAction: (kind: ModalKind, card: EnrichedOpportunity) => void
}

interface MenuItem {
  label: string
  bg: string
  fg: string
  kind: ModalKind
  enabled: boolean
}

const DISABLED_TITLE = 'Only available once the initial meeting is Held'

export default function ActionsMenu({ card, isHeld, onAction }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const items: MenuItem[] = [
    { label: 'View/Edit', bg: '#F5F5F5', fg: '#434343', kind: 'edit', enabled: true },
    { label: 'Qualified (SQO)', bg: '#E8F5E9', fg: '#2E7D32', kind: 'qualify', enabled: isHeld },
    { label: 'Nurture (SAO)', bg: '#FFF3E0', fg: '#B35C00', kind: 'nurture', enabled: isHeld },
    { label: 'Disqualify', bg: '#FDECEC', fg: '#D32F2F', kind: 'dq', enabled: true },
  ]

  const MENU_HEIGHT = items.length * 33 + (items.length - 1) * 3 + 12

  function toggle() {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const left = Math.min(r.right - 212, window.innerWidth - 224)
      const fitsBelow = r.bottom + 4 + MENU_HEIGHT <= window.innerHeight
      const top = fitsBelow ? r.bottom + 4 : Math.max(8, r.top - 4 - MENU_HEIGHT)
      setPos({ top, left })
    }
    setOpen(true)
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Open Sans', sans-serif",
          fontSize: 12, fontWeight: 600, border: `1px solid ${open ? '#0073E6' : '#E0E0E0'}`,
          background: open ? '#e6f1fd' : '#fff', color: open ? '#003F7F' : '#434343',
        }}
      >
        <span>Actions</span>
        <span style={{ fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div style={{
            position: 'fixed', zIndex: 51, top: pos.top, left: pos.left, width: 212,
            display: 'flex', flexDirection: 'column', gap: 3, padding: 6, borderRadius: 10,
            background: '#fff', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
          }}>
            {items.map(item => (
              <button
                key={item.kind}
                title={item.enabled ? undefined : DISABLED_TITLE}
                onClick={() => { if (item.enabled) { setOpen(false); onAction(item.kind, card) } }}
                style={{
                  textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6,
                  background: item.bg, color: item.fg, fontFamily: "'Open Sans', sans-serif",
                  fontSize: 12, fontWeight: 600, cursor: item.enabled ? 'pointer' : 'not-allowed',
                  opacity: item.enabled ? 1 : 0.4,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
