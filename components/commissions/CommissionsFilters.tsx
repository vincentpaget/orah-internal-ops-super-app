'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const SELECT_STYLE: React.CSSProperties = {
  height: 34,
  padding: '0 28px 0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--fg-1)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%23667085' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  minWidth: 220,
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
    </span>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: 16, height: 16, flexShrink: 0, borderRadius: 3,
      border: `1.5px solid ${checked ? 'var(--navy-900)' : 'var(--border-strong)'}`,
      background: checked ? 'var(--navy-900)' : 'var(--bg)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 100ms, border-color 100ms',
    }}>
      {checked && <CheckIcon />}
    </span>
  )
}

function MultiSelectDropdown({
  options,
  selected,
  onToggle,
  placeholder,
  itemLabel,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  placeholder: string
  itemLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedLabels = options.filter(o => selected.includes(o.value)).map(o => o.label)
  const label = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} ${itemLabel} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...SELECT_STYLE,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
        }}
      >
        <span style={{ color: selected.length > 0 ? 'var(--fg-1)' : 'var(--fg-2)' }}>{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: 'transform 120ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M3 4.5l3 3 3-3" stroke="#667085" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          minWidth: 220, maxHeight: 280, overflowY: 'auto',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}>
          {options.map(o => {
            const checked = selected.includes(o.value)
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={checked}
                onClick={() => onToggle(o.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  cursor: 'pointer', fontSize: 13, color: 'var(--fg-1)',
                  background: checked ? 'var(--blue-50)' : 'var(--bg)',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background 80ms', userSelect: 'none',
                }}
                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)' }}
                onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
              >
                <Checkbox checked={checked} />
                <span>{o.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface Props {
  selectedOwner: string | null
  owners: { ownerId: string; ownerName: string }[]
  selectedQuarters: string[]
  quarterOptions: { value: string; label: string }[]
}

export default function CommissionsFilters({
  selectedOwner,
  owners,
  selectedQuarters,
  quarterOptions,
}: Props) {
  const router = useRouter()

  function navigate(nextOwner: string | null, nextQuarters: string[]) {
    const params = new URLSearchParams()
    if (nextOwner) params.set('owner', nextOwner)
    params.set('quarters', nextQuarters.join(','))
    router.push(`/commissions?${params.toString()}`)
  }

  function toggleQuarter(quarterKey: string) {
    const next = selectedQuarters.includes(quarterKey)
      ? selectedQuarters.filter(k => k !== quarterKey)
      : [...selectedQuarters, quarterKey]
    navigate(selectedOwner, next)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label>Rep</Label>
        <select value={selectedOwner ?? ''} onChange={e => navigate(e.target.value || null, selectedQuarters)} style={SELECT_STYLE}>
          <option value="">Select a rep…</option>
          {owners.map(o => <option key={o.ownerId} value={o.ownerId}>{o.ownerName}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label>Quarters</Label>
        <MultiSelectDropdown
          options={quarterOptions}
          selected={selectedQuarters}
          onToggle={toggleQuarter}
          placeholder="No quarters selected"
          itemLabel="quarters"
        />
      </div>
    </div>
  )
}
