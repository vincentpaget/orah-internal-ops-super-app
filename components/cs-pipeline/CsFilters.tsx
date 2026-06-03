'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FS } from '@/lib/fontSizes'

interface Props {
  owners: string[]
  availableTypes: string[]
  activeOwner: string | null
  activeDatePreset: string | null
  activeFrom: string | null
  activeTo: string | null
  activeRecordType: string | null
  activeTypes: string[]
  activeView: string
  activeStage: string | null
  showRecordType?: boolean
  showType?: boolean
  lockedRecordType?: string
  showRevOpsFilters?: boolean
  availableStages?: string[]
  activeStages?: string[]
  availablePricebooks?: string[]
  activePricebooks?: string[]
  activeAutoRenewalDir?: string | null
  activeWidget?: string | null
  activeTile?: string | null
  dateLabel?: string
}

const DATE_PRESETS = [
  { value: 'past_due',      label: 'Past due' },
  { value: 'next_7_days',   label: 'Next 7 days' },
  { value: 'next_14_days',  label: 'Next 14 days' },
  { value: 'next_30_days',  label: 'Next 30 days' },
  { value: 'next_90_days',  label: 'Next 90 days' },
  { value: 'next_120_days', label: 'Next 120 days' },
  { value: 'this_quarter',  label: 'This Quarter' },
  { value: 'next_quarter',  label: 'Next Quarter' },
  { value: 'last_quarter',  label: 'Last Quarter' },
  { value: 'this_year',     label: 'This Year' },
  { value: 'custom',        label: 'Custom dates…' },
]

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
  minWidth: 150,
}

const DATE_INPUT_STYLE: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--fg-1)',
  fontSize: 13,
  fontFamily: 'inherit',
}

function LockedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      height: 34, display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '0 10px', borderRadius: 6,
      border: '1px solid var(--border)', background: 'var(--bg-subtle)',
      color: 'var(--fg-3)', fontSize: 13, fontFamily: 'inherit',
      userSelect: 'none', whiteSpace: 'nowrap',
    }}>
      <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
        <rect x="1.5" y="5.5" width="8" height="5.5" rx="1.25" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M3 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
      {children}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...FS.badge, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

function TypeDropdown({
  availableTypes,
  activeTypes,
  onToggle,
  placeholder = 'All types',
}: {
  availableTypes: string[]
  activeTypes: string[]
  onToggle: (type: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = activeTypes.length === 0
    ? placeholder
    : activeTypes.length === 1
      ? activeTypes[0]
      : `${activeTypes.length} selected`

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
          minWidth: 150,
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
        }}
      >
        <span style={{ color: activeTypes.length > 0 ? 'var(--fg-1)' : 'var(--fg-2)' }}>
          {label}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: 'transform 120ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M3 4.5l3 3 3-3" stroke="#667085" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          minWidth: 200, background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden',
        }}>
          {availableTypes.map(type => {
            const checked = activeTypes.includes(type)
            return (
              <div
                key={type}
                role="option"
                aria-selected={checked}
                onClick={() => onToggle(type)}
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
                <span>{type}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function buildUrl(
  params: Record<string, string | null>,
  types: string[],
  stages: string[],
  pricebooks: string[],
) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v)
  }
  if (types.length > 0) p.set('types', types.join(','))
  if (stages.length > 0) p.set('stages', stages.join(','))
  if (pricebooks.length > 0) p.set('pricebooks', pricebooks.join(','))
  return `/cs-pipeline?${p.toString()}`
}

export default function CsFilters({
  owners,
  availableTypes,
  activeOwner,
  activeDatePreset,
  activeFrom,
  activeTo,
  activeRecordType,
  activeTypes,
  activeView,
  activeStage,
  showRecordType = true,
  showType = true,
  lockedRecordType,
  showRevOpsFilters = false,
  availableStages = [],
  activeStages = [],
  availablePricebooks = [],
  activePricebooks = [],
  activeAutoRenewalDir = null,
  activeWidget = null,
  activeTile = null,
  dateLabel = 'Close date',
}: Props) {
  const router = useRouter()

  const [customFrom, setCustomFrom] = useState(activeFrom ?? '')
  const [customTo,   setCustomTo]   = useState(activeTo   ?? '')

  const isCustom = activeDatePreset === 'custom'

  function baseParams(overrides: Partial<Record<'owner' | 'datePreset' | 'from' | 'to' | 'recordType' | 'autoRenewalDir' | 'widget' | 'tile', string | null>>) {
    return {
      view:           activeView,
      stage:          activeStage,
      owner:          activeOwner,
      datePreset:     activeDatePreset,
      from:           isCustom ? (activeFrom ?? null) : null,
      to:             isCustom ? (activeTo   ?? null) : null,
      recordType:     activeRecordType,
      autoRenewalDir: activeAutoRenewalDir,
      widget:         activeWidget,
      tile:           activeTile,
      ...overrides,
    }
  }

  function update(
    overrides: Partial<Record<'owner' | 'datePreset' | 'from' | 'to' | 'recordType' | 'autoRenewalDir' | 'widget' | 'tile', string | null>>,
    typesOverride?: string[],
    stagesOverride?: string[],
    pricebooksOverride?: string[],
  ) {
    router.push(buildUrl(
      baseParams(overrides),
      typesOverride    ?? activeTypes,
      stagesOverride   ?? activeStages,
      pricebooksOverride ?? activePricebooks,
    ))
  }

  function handlePresetChange(value: string) {
    if (value === '') {
      update({ datePreset: null, from: null, to: null })
    } else if (value === 'custom') {
      update({ datePreset: 'custom', from: null, to: null })
    } else {
      update({ datePreset: value, from: null, to: null })
    }
  }

  function applyCustomDates() {
    if (customFrom && customTo) {
      update({ datePreset: 'custom', from: customFrom, to: customTo })
    }
  }

  function toggleType(type: string) {
    const next = activeTypes.includes(type)
      ? activeTypes.filter(t => t !== type)
      : [...activeTypes, type]
    update({}, next)
  }

  function toggleStage(stage: string) {
    const next = activeStages.includes(stage)
      ? activeStages.filter(s => s !== stage)
      : [...activeStages, stage]
    update({}, undefined, next)
  }

  function togglePricebook(pb: string) {
    const next = activePricebooks.includes(pb)
      ? activePricebooks.filter(p => p !== pb)
      : [...activePricebooks, pb]
    update({}, undefined, undefined, next)
  }

  const hasFilters = activeOwner
    || activeDatePreset
    || (showType && activeTypes.length > 0)
    || (showRecordType && !lockedRecordType && activeRecordType)
    || (showRevOpsFilters && activeStages.length > 0)
    || (showRevOpsFilters && activePricebooks.length > 0)
    || (showRevOpsFilters && !!activeAutoRenewalDir)
    || (showRevOpsFilters && !!activeWidget)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>

      {/* Owner */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label>Owner</Label>
        <select
          value={activeOwner ?? ''}
          onChange={e => update({ owner: e.target.value || null })}
          style={SELECT_STYLE}
        >
          <option value="">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Record Type */}
      {showRecordType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Record Type</Label>
          {lockedRecordType ? (
            <LockedBadge>{lockedRecordType === 'renewals' ? 'Renewals' : 'Expansions'}</LockedBadge>
          ) : (
            <select
              value={activeRecordType ?? ''}
              onChange={e => update({ recordType: e.target.value || null })}
              style={SELECT_STYLE}
            >
              <option value="">All records</option>
              <option value="renewals">Renewals</option>
              <option value="expansions">Expansions</option>
            </select>
          )}
        </div>
      )}

      {/* Type — multi-select dropdown */}
      {showType && availableTypes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Type</Label>
          <TypeDropdown
            availableTypes={availableTypes}
            activeTypes={activeTypes}
            onToggle={toggleType}
          />
        </div>
      )}

      {/* Close date preset */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label>{dateLabel}</Label>
        <select
          value={activeDatePreset ?? ''}
          onChange={e => handlePresetChange(e.target.value)}
          style={SELECT_STYLE}
        >
          {!activeDatePreset && <option value="" disabled>Select period…</option>}
          {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* Custom date inputs */}
      {isCustom && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>From</Label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={DATE_INPUT_STYLE}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>To</Label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={DATE_INPUT_STYLE}
            />
          </div>
          <button
            onClick={applyCustomDates}
            disabled={!customFrom || !customTo}
            style={{
              height: 34, padding: '0 14px', borderRadius: 6,
              border: '1px solid var(--navy-900)', background: 'var(--navy-900)',
              color: '#fff', fontSize: 13, fontFamily: 'inherit',
              cursor: customFrom && customTo ? 'pointer' : 'not-allowed',
              opacity: customFrom && customTo ? 1 : 0.45,
            }}
          >
            Apply
          </button>
        </>
      )}

      {/* RevOps filters */}
      {showRevOpsFilters && (
        <>
          {availableStages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Stage</Label>
              <TypeDropdown
                availableTypes={availableStages}
                activeTypes={activeStages}
                onToggle={toggleStage}
                placeholder="All stages"
              />
            </div>
          )}
          {availablePricebooks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Pricebook</Label>
              {activeWidget === 'inactive_pricebook' ? (
                <LockedBadge>Inactive pricebooks</LockedBadge>
              ) : (
                <TypeDropdown
                  availableTypes={availablePricebooks}
                  activeTypes={activePricebooks}
                  onToggle={togglePricebook}
                  placeholder="All pricebooks"
                />
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>Auto Renewal Net ARR</Label>
            {activeWidget === 'auto_renewal_lte_zero' ? (
              <LockedBadge>▼ ≤ 0</LockedBadge>
            ) : (
              <select
                value={activeAutoRenewalDir ?? ''}
                onChange={e => update({ autoRenewalDir: e.target.value || null })}
                style={SELECT_STYLE}
              >
                <option value="">All</option>
                <option value="positive">▲ Positive (&gt; 0)</option>
                <option value="negative">▼ Negative (&lt; 0)</option>
              </select>
            )}
          </div>
        </>
      )}

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={() => update({ owner: null, datePreset: null, from: null, to: null, recordType: lockedRecordType ?? null, autoRenewalDir: null, widget: null }, [], [], [])}
          style={{
            height: 34, padding: '0 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--fg-2)', fontSize: 13, fontFamily: 'inherit',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Clear filters
        </button>
      )}
    </div>
  )
}
