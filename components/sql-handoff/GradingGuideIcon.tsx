'use client'

import { useRef, useState } from 'react'
import type { MeddiccKey } from '@/lib/sql-handoff/types'
import { GRADE_GUIDE, gradeColors } from '@/lib/sql-handoff/logic'

interface Props {
  meddiccKey: MeddiccKey
  label: string
}

export default function GradingGuideIcon({ meddiccKey, label }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)
  const entries = GRADE_GUIDE[meddiccKey]

  function handleEnter() {
    const r = ref.current?.getBoundingClientRect()
    if (r) {
      const gh = 220
      setPos({
        top: r.bottom + 6 + gh > window.innerHeight ? Math.max(8, r.top - gh - 6) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 352)),
      })
    }
    setOpen(true)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setOpen(false)}
        title="Grading guide"
        style={{
          flexShrink: 0, width: 16, height: 16, borderRadius: 100, border: '1px solid #9CC9F5',
          background: '#e6f1fd', color: '#0073E6', fontSize: 10, fontWeight: 700, fontStyle: 'italic',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help',
        }}
      >
        i
      </span>
      {open && (
        <div style={{
          position: 'fixed', zIndex: 90, pointerEvents: 'none', top: pos.top, left: pos.left, width: 344,
          background: '#fff', border: '1px solid #EEEEEE', borderRadius: 10, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          fontFamily: "'Open Sans', sans-serif",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9E9E9E' }}>
            {label} · Grading Guide
          </span>
          {entries.map(e => {
            const tint = gradeColors(e.grade)
            return (
              <div key={e.grade} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: tint.bg, color: tint.fg }}>
                  {e.grade}
                </span>
                <span style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(0,0,0,0.66)' }}>{e.text}</span>
              </div>
            )
          })}
        </div>
      )}
    </span>
  )
}
