'use client'

import { useState, useRef, useEffect } from 'react'

export interface Lead {
  _key: string
  first_name: string
  last_name: string
  job_title: string
  email: string
  email_confidence: string
  company: string
  campaign_status: string
  sf_campaign_id: string
  assigned_to_email: string
  all_notes: string[]
  notes_summary?: string
  school_domain?: string
}

export interface FlaggedItem {
  reason: string
  flag_type: string
  keys: string[]
  rows: string[]
  recommendation?: string
}

type ActiveTile = 'all' | 'intent' | 'email' | 'noemail'

const STATUS_OPTS = ['Demo Interest (MQL)', 'Expansion Interest (CMQL)', 'CSM FUp Required', 'Engaged Outside Booth', 'Visited Booth', 'RSVP']
const STATUS_RANK: Record<string, number> = { 'Demo Interest (MQL)': 5, 'Expansion Interest (CMQL)': 4, 'CSM FUp Required': 3, 'Engaged Outside Booth': 2, 'Visited Booth': 1, 'RSVP': 0 }
const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Demo Interest (MQL)':      { bg: '#fdf0f9', color: '#9b1f6b',         border: '#f5c6e7' },
  'Expansion Interest (CMQL)':{ bg: '#eff6ff', color: 'var(--blue-600)', border: '#bfdbfe' },
  'CSM FUp Required':         { bg: '#fff7ed', color: 'var(--orange-700)',border: '#fed7aa' },
  'Engaged Outside Booth':    { bg: '#f0fdf4', color: 'var(--green-700)', border: '#bbf7d0' },
  'Visited Booth':            { bg: 'var(--bg)', color: 'var(--fg-3)',    border: 'var(--border)' },
  'RSVP':                     { bg: 'var(--bg)', color: 'var(--fg-3)',    border: 'var(--border)' },
}
const CONF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  clay:       { bg: '#eff6ff', color: 'var(--blue-600)',   border: '#bfdbfe' },
  verified:   { bg: '#f0fdf4', color: 'var(--green-700)',  border: '#bbf7d0' },
  researched: { bg: '#fff7ed', color: 'var(--orange-700)', border: '#fed7aa' },
  guessed:    { bg: '#fffbeb', color: 'var(--amber-700)',  border: '#fde68a' },
  missing:    { bg: '#fef2f2', color: 'var(--red-600)',    border: '#fecaca' },
}

function ConfBadge({ confidence, hasEmail }: { confidence: string; hasEmail: boolean }) {
  const key = confidence || (hasEmail ? 'verified' : 'missing')
  const s = CONF_STYLE[key] || CONF_STYLE.missing
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, border: `1px solid ${s.border}`, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {key}
    </span>
  )
}

interface Props {
  leads: Lead[]
  flagged: FlaggedItem[]
  eventName: string
  onEventNameChange: (v: string) => void
  onUpdate: (key: string, field: string, value: string) => void
  onDismissFlag: (key: string) => void
  onDelete: (key: string) => void
}

export default function LeadTable({ leads, flagged, eventName, onEventNameChange, onUpdate, onDismissFlag, onDelete }: Props) {
  const [activeTile, setActiveTile] = useState<ActiveTile>('all')
  const [search, setSearch] = useState('')
  const eventNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setActiveTile('all'); setSearch('') }, [leads.length])

  const hi = leads.filter(l => ['Demo Interest (MQL)', 'Expansion Interest (CMQL)'].includes(l.campaign_status)).length
  const we = leads.filter(l => l.email).length

  const filtered = leads.filter(l => {
    if (search) return (l.first_name + ' ' + l.last_name + ' ' + l.company + ' ' + l.campaign_status).toLowerCase().includes(search.toLowerCase())
    if (activeTile === 'intent') return ['Demo Interest (MQL)', 'Expansion Interest (CMQL)'].includes(l.campaign_status)
    if (activeTile === 'email') return !!l.email
    if (activeTile === 'noemail') return !l.email
    return true
  })

  const flagMap: Record<string, string[]> = {}
  flagged.forEach(f => (f.keys || []).forEach(k => { flagMap[k] = flagMap[k] || []; flagMap[k].push(f.reason) }))

  const tileBtn = (key: ActiveTile, value: number, label: string, valueColor?: string) => (
    <div
      onClick={() => { setActiveTile(key); setSearch('') }}
      style={{
        background: activeTile === key ? 'var(--bg-subtle, #f4f6f9)' : 'var(--bg)',
        border: `1px solid ${activeTile === key ? 'var(--blue-500)' : 'var(--border)'}`,
        borderRadius: 10, padding: '12px 14px', cursor: 'pointer', flex: 1, userSelect: 'none',
        boxShadow: activeTile === key ? '0 0 0 1px var(--blue-500)' : 'none',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? 'var(--fg-1)', lineHeight: 1.1, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</div>
    </div>
  )

  const cellInput = (lead: Lead, field: keyof Lead, placeholder = '—', color?: string) => (
    <input
      value={String(lead[field] || '')}
      placeholder={placeholder}
      onChange={e => onUpdate(lead._key, field, e.target.value)}
      style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', fontSize: 12, color: color || (lead[field] ? 'var(--fg-1)' : 'var(--fg-3)'), fontFamily: 'inherit', outline: 'none', cursor: 'text' }}
      onFocus={e => { e.currentTarget.style.background = '#fffaf7'; e.currentTarget.style.boxShadow = 'inset 0 0 0 1.5px var(--blue-500)' }}
      onBlur={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )

  const noteValue = (l: Lead) => l.notes_summary || l.all_notes?.filter(Boolean).join(' | ') || ''

  return (
    <div>
      {/* Event name */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', marginBottom: 4 }}>Event</div>
        <input
          ref={eventNameRef}
          value={eventName}
          onChange={e => onEventNameChange(e.target.value)}
          placeholder="Unnamed event"
          style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: '2px solid transparent', paddingBottom: 3, width: '100%', fontFamily: 'inherit', cursor: 'text', transition: 'border-color .15s' }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--blue-500)')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
        />
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {tileBtn('all', leads.length, 'Total leads')}
        {tileBtn('intent', hi, 'High intent', 'var(--red-600)')}
        {tileBtn('email', we, 'Have email', 'var(--green-700)')}
        {tileBtn('noemail', leads.length - we, 'Missing email', 'var(--amber-700)')}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveTile('all') }}
          placeholder="Search name, company, status…"
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: 'var(--fg-1)', fontFamily: 'inherit', outline: 'none' }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue-500)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', width: 'auto', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['First name', 'Last name', 'Job title', 'Email', 'Conf.', 'Company', 'Campaign status', 'SF Campaign ID', 'Assigned to', 'Notes', 'Flag', ''].map((h, i) => (
                  <th key={i} style={{ background: 'var(--bg-subtle, #f4f6f9)', padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--fg-3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: i === 9 ? 220 : i === 10 ? 110 : undefined, width: i === 11 ? 32 : undefined }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const ss = STATUS_STYLE[l.campaign_status] || STATUS_STYLE['Visited Booth']
                const flagReasons = flagMap[l._key]
                const td = (content: React.ReactNode, extra?: React.CSSProperties) => (
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', verticalAlign: 'top', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...extra }}>{content}</td>
                )
                return (
                  <tr key={l._key} style={{ transition: 'background .1s' }} onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => (c.style.background = '#fffbf7'))} onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => (c.style.background = ''))}>
                    {td(cellInput(l, 'first_name'))}
                    {td(cellInput(l, 'last_name'))}
                    {td(cellInput(l, 'job_title', '—', l.job_title ? undefined : 'var(--fg-3)'))}
                    {td(cellInput(l, 'email', '—', l.email ? 'var(--green-700)' : 'var(--fg-3)'))}
                    {td(<ConfBadge confidence={l.email_confidence} hasEmail={!!l.email} />, { whiteSpace: 'normal' })}
                    {td(cellInput(l, 'company', '—'))}
                    {td(
                      <select
                        value={l.campaign_status}
                        onChange={e => onUpdate(l._key, 'campaign_status', e.target.value)}
                        style={{ border: `1px solid ${ss.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none', background: ss.bg, color: ss.color }}
                      >
                        {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>,
                      { whiteSpace: 'normal' }
                    )}
                    {td(cellInput(l, 'sf_campaign_id', '—', l.sf_campaign_id ? 'var(--blue-600)' : 'var(--fg-3)'), { fontSize: 11 })}
                    {td(cellInput(l, 'assigned_to_email', '—', l.assigned_to_email ? undefined : 'var(--fg-3)'), { fontSize: 11 })}
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', verticalAlign: 'top', whiteSpace: 'normal', minWidth: 220, maxWidth: 320, maxHeight: 58, overflow: 'hidden' }}>
                      <textarea
                        value={noteValue(l)}
                        onChange={e => onUpdate(l._key, 'notes_summary', e.target.value)}
                        rows={2}
                        style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', fontSize: 11, lineHeight: 1.5, color: 'var(--fg-2)', fontFamily: 'inherit', outline: 'none', resize: 'none', cursor: 'text' }}
                        onFocus={e => { e.currentTarget.style.background = '#fffaf7' }}
                        onBlur={e => { e.currentTarget.style.background = 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', verticalAlign: 'top', width: 110, minWidth: 110 }}>
                      {flagReasons && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, border: '1px solid #fde68a', background: '#fffbeb', color: 'var(--amber-700)', whiteSpace: 'nowrap' }}>⚑ Flagged</span>
                          <div title={flagReasons.join(' · ')} style={{ fontSize: 10, color: 'var(--fg-3)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flagReasons[0]}</div>
                          <button onClick={() => onDismissFlag(l._key)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}>Ignore</button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', textAlign: 'center', width: 32 }}>
                      <button onClick={() => onDelete(l._key)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 15, padding: '0 4px', lineHeight: 1, borderRadius: 3 }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--red-600)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-3)')}>×</button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>No leads match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>✎ Click any cell to edit before sending</div>
    </div>
  )
}

export { STATUS_RANK }
