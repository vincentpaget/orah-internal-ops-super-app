'use client'

import { useRef, useState } from 'react'

interface Props {
  text: string
}

export default function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  function handleEnter() {
    const r = ref.current?.getBoundingClientRect()
    if (r) {
      const width = 280
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) })
    }
    setOpen(true)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setOpen(false)}
        style={{
          flexShrink: 0, width: 14, height: 14, borderRadius: 100, border: '1px solid #9CC9F5',
          background: '#e6f1fd', color: '#0073E6', fontSize: 9, fontWeight: 700, fontStyle: 'italic',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help',
        }}
      >
        i
      </span>
      {open && (
        <div style={{
          position: 'fixed', zIndex: 90, pointerEvents: 'none', top: pos.top, left: pos.left, width: 280,
          background: '#fff', border: '1px solid #EEEEEE', borderRadius: 10, padding: '10px 12px',
          fontSize: 12, lineHeight: '17px', color: 'rgba(0,0,0,0.66)', fontFamily: "'Open Sans', sans-serif",
          fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}
