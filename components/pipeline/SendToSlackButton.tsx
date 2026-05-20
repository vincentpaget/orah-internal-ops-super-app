'use client'

import { useState } from 'react'
import { FS } from '@/lib/fontSizes'

type State = 'idle' | 'loading' | 'sent' | 'error'

export default function SendToSlackButton({ period }: { period: string }) {
  const [state, setState] = useState<State>('idle')

  async function send() {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch(`/api/slack/send-leaderboard?period=${period}`, { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 3000)
  }

  const configs: Record<State, { label: string; bg: string; color: string; border: string }> = {
    idle:    { label: 'Send to Slack',  bg: 'transparent',          color: 'var(--fg-2)',     border: 'var(--border)' },
    loading: { label: 'Sending…',       bg: 'transparent',          color: 'var(--fg-3)',     border: 'var(--border)' },
    sent:    { label: '✓ Sent',         bg: 'var(--green-50)',       color: 'var(--green-700)', border: 'rgba(34,158,72,0.3)' },
    error:   { label: '✗ Failed',       bg: 'var(--red-50)',         color: 'var(--red-700)',   border: 'rgba(201,17,31,0.3)' },
  }

  const { label, bg, color, border } = configs[state]

  return (
    <button
      onClick={send}
      disabled={state === 'loading'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 7,
        border: `1px solid ${border}`,
        background: bg,
        color,
        ...FS.badge,
        fontWeight: 500,
        cursor: state === 'loading' ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms, color 120ms, border-color 120ms',
        flexShrink: 0,
      }}
    >
      {state === 'idle' || state === 'loading' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: state === 'loading' ? 0.4 : 0.7 }}>
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="currentColor"/>
        </svg>
      ) : null}
      {label}
    </button>
  )
}
