'use client'

import { useRef, useCallback } from 'react'

export interface LogEntry {
  ts: number
  kind: 'info' | 'ok' | 'err' | 'warn'
  msg: string
}

interface Props {
  entries: LogEntry[]
  height: number
  onHeightChange: (h: number) => void
}

const KIND_COLOR: Record<LogEntry['kind'], string> = {
  info: 'var(--blue-600)',
  ok: 'var(--green-700)',
  err: 'var(--red-600)',
  warn: 'var(--amber-700)',
}

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  info: 'INFO',
  ok: 'OK',
  err: 'ERR',
  warn: 'WARN',
}

export default function ActivityLog({ entries, height, onHeightChange }: Props) {
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startY.current = e.clientY
    startH.current = height

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = startY.current - ev.clientY
      const newH = Math.max(60, Math.min(Math.floor(window.innerHeight * 0.65), startH.current + delta))
      onHeightChange(newH)
    }

    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [height, onHeightChange])

  if (entries.length === 0 && height <= 60) return null

  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderTop: '2px solid var(--border)', padding: '0 24px 12px', zIndex: 10 }}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{ height: 6, margin: '0 -24px 8px', cursor: 'ns-resize', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ width: 40, height: 3, background: 'var(--border)', borderRadius: 2 }} />
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--fg-3)', marginBottom: 6 }}>
        Activity Log
      </div>
      <div style={{ height, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>No activity yet.</div>
        ) : (
          [...entries].reverse().map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--fg-3)', flexShrink: 0, fontFamily: 'monospace', fontSize: 11 }}>
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 700, width: 38, color: KIND_COLOR[e.kind], fontSize: 11 }}>
                {KIND_LABEL[e.kind]}
              </span>
              <span style={{ flex: 1, color: 'var(--fg-2)' }}>{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
