'use client'

import { useRef, useState } from 'react'
import type { EnrichedOpportunity } from '@/lib/sql-handoff/types'

interface Props {
  card: EnrichedOpportunity
}

export default function WarningBadge({ card }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const bg = card.warnCount === 0 ? '#E8F5E9' : card.warnCount >= 3 ? '#FDECEC' : '#FFF3E0'
  const fg = card.warnCount === 0 ? '#2E7D32' : card.warnCount >= 3 ? '#D32F2F' : '#B35C00'

  function handleEnter() {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 272) })
    setOpen(true)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setOpen(false)}
        style={{
          fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: 'center', padding: '3px 8px',
          borderRadius: 100, background: bg, color: fg, cursor: 'help', display: 'inline-block',
        }}
      >
        {card.warnCount}
      </span>
      {open && (
        <div style={{
          position: 'fixed', zIndex: 80, pointerEvents: 'none', top: pos.top, left: pos.left,
          width: 264, background: '#fff', border: '1px solid #EEEEEE', borderRadius: 10,
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontFamily: "'Open Sans', sans-serif",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }}>
            {card.warnCount === 0 ? 'No warnings' : `${card.warnCount} Warning${card.warnCount === 1 ? '' : 's'}`}
          </span>
          {card.warnCount === 0 ? (
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.54)' }}>This opportunity is clean.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {card.warnList.map(w => (
                <div key={w.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 100, background: '#F57C00', flexShrink: 0, marginTop: 6 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#262626', lineHeight: '17px' }}>{w.label}</span>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.54)', lineHeight: '16px' }}>{w.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
