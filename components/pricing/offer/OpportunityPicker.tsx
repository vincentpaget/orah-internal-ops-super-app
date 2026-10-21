'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProposalOpp } from '@/app/api/pricing/opportunities/route'
import { INPUT } from './ui'

export default function OpportunityPicker({ selected, onSelect }: { selected: ProposalOpp | null; onSelect: (opp: ProposalOpp) => void }) {
  const [opps, setOpps] = useState<ProposalOpp[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/pricing/opportunities')
      .then(async res => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
        if (!cancelled) setOpps(body.opportunities)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!opps) return []
    const q = query.trim().toLowerCase()
    if (!q) return opps
    return opps.filter(o => `${o.accountName} ${o.name} ${o.ownerName}`.toLowerCase().includes(q))
  }, [opps, query])

  if (error) {
    return <div style={{ color: 'var(--red-600)', fontSize: 13 }}>Couldn&apos;t load opportunities from Salesforce: {error}</div>
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        placeholder={opps ? `Search ${opps.length} open Evaluation / Proposal opportunities…` : 'Loading opportunities…'}
        disabled={!opps}
        value={open ? query : selected ? `${selected.accountName} · ${selected.name}` : query}
        onFocus={() => { setOpen(true); setQuery('') }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => setQuery(e.target.value)}
        style={{ ...INPUT, width: '100%' }}
      />
      {open && opps && (
        <div
          role="listbox"
          style={{
            position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4,
            maxHeight: 320, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border-strong)',
            borderRadius: 8, boxShadow: 'var(--shadow-2)',
          }}
        >
          {filtered.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--fg-3)' }}>No matching opportunities</div>}
          {filtered.slice(0, 100).map(o => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={selected?.id === o.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(o); setOpen(false); setQuery('') }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                background: selected?.id === o.id ? 'var(--blue-50)' : 'var(--bg)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>{o.accountName}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{o.name} · {o.stage} · {o.ownerName}</div>
            </button>
          ))}
          {filtered.length > 100 && (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--fg-3)' }}>Showing first 100 of {filtered.length}. Keep typing to narrow down.</div>
          )}
        </div>
      )}
    </div>
  )
}
