'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  period: string
  repId?: string
}

const PERIODS = [
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'next_quarter', label: 'Next Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
]

function SelectWrapper({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 5px' }}>
        {label}
      </p>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            appearance: 'none',
            padding: '7px 30px 7px 12px',
            borderRadius: 7,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg)',
            color: 'var(--fg-1)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
            minWidth: 160,
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <path d="M2 4l4 4 4-4" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

export default function PipelineFilters({ period, repId }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  function update(value: string) {
    const params = new URLSearchParams()
    params.set('period', value)
    if (repId) params.set('rep', repId)
    router.push(`/pipeline?${params.toString()}`)
  }

  function handleSync() {
    setSyncing(true)
    router.refresh()
    setTimeout(() => setSyncing(false), 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
      <SelectWrapper
        label="Close date"
        value={period}
        options={PERIODS}
        onChange={update}
      />

      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 16px',
            borderRadius: 7,
            border: '1px solid var(--border-strong)',
            background: syncing ? 'var(--bg-subtle)' : 'var(--bg)',
            color: syncing ? 'var(--fg-3)' : 'var(--fg-2)',
            fontSize: 13,
            fontWeight: 500,
            cursor: syncing ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'color 150ms, background 150ms',
          }}
        >
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ animation: syncing ? 'sf-spin 0.8s linear infinite' : 'none' }}
          >
            <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 2.5l2.3 1.8-1.8 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {syncing ? 'Syncing…' : 'Sync with Salesforce'}
        </button>
      </div>
    </div>
  )
}
