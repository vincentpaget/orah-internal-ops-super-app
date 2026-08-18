'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { EnrichedOpportunity, ModalKind, WarningKey } from '@/lib/sql-handoff/types'
import { WARNINGS, NURTURE_TABS, NURTURE_WARNING_KEYS, matchNurtureTab } from '@/lib/sql-handoff/logic'
import type { NurtureTabKey } from '@/lib/sql-handoff/logic'
import NurturingTable from './NurturingTable'
import MultiSelectFilter from './MultiSelectFilter'

interface Props {
  scoped: EnrichedOpportunity[]
  filtered: EnrichedOpportunity[]
  rowsForTab: EnrichedOpportunity[]
  query: string
  onQueryChange: (v: string) => void
  ownerSel: string[]
  onToggleOwner: (v: string) => void
  onClearOwner: () => void
  ownerOptions: string[]
  rtypeSel: string[]
  onToggleRtype: (v: string) => void
  onClearRtype: () => void
  rtypeOptions: string[]
  creatorSel: string[]
  onToggleCreator: (v: string) => void
  onClearCreator: () => void
  creatorOptions: string[]
  warnSel: WarningKey[]
  onToggleWarn: (k: WarningKey) => void
  onClearWarn: () => void
  tab: NurtureTabKey
  onTabChange: (t: NurtureTabKey) => void
  sortKey: string
  sortDir: 1 | -1
  onSort: (k: string) => void
  onInlineSave: (card: EnrichedOpportunity, patch: { reengage: string; nurtureReason: string; nextStep: string; managerReviewNotes: string }) => Promise<boolean>
  onAction: (kind: ModalKind, card: EnrichedOpportunity) => void
}

const INPUT: CSSProperties = {
  height: 34, padding: '0 12px', fontFamily: "'Open Sans', sans-serif", fontSize: 14,
  color: '#262626', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 6, outline: 'none',
}

export default function NurturingView({
  scoped, filtered, rowsForTab, query, onQueryChange,
  ownerSel, onToggleOwner, onClearOwner, ownerOptions,
  rtypeSel, onToggleRtype, onClearRtype, rtypeOptions,
  creatorSel, onToggleCreator, onClearCreator, creatorOptions,
  warnSel, onToggleWarn, onClearWarn, tab, onTabChange, sortKey, sortDir, onSort, onInlineSave, onAction,
}: Props) {
  const [warnFilterOpen, setWarnFilterOpen] = useState(false)
  const nurtureWarnings = WARNINGS.filter(w => NURTURE_WARNING_KEYS.includes(w.key))
  const activeTab = NURTURE_TABS.find(t => t.key === tab)!

  return (
    <>
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search opportunities" value={query}
          onChange={e => onQueryChange(e.target.value)} style={{ ...INPUT, width: 240 }}
        />
        <MultiSelectFilter
          label="Record types" allLabel="All record types" options={rtypeOptions}
          selected={rtypeSel} onToggle={onToggleRtype} onClear={onClearRtype}
        />
        <MultiSelectFilter
          label="Creators" allLabel="All creators" options={creatorOptions}
          selected={creatorSel} onToggle={onToggleCreator} onClear={onClearCreator}
        />
        <MultiSelectFilter
          label="Owners" allLabel="All owners" options={ownerOptions}
          selected={ownerSel} onToggle={onToggleOwner} onClear={onClearOwner}
        />

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setWarnFilterOpen(o => !o)}
            style={{
              height: 34, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Open Sans', sans-serif",
              fontSize: 14, border: `1px solid ${warnSel.length ? '#0073E6' : '#E0E0E0'}`,
              background: warnSel.length ? '#e6f1fd' : '#fff', color: warnSel.length ? '#003F7F' : '#262626',
            }}
          >
            {warnSel.length ? `Warnings · ${warnSel.length}` : 'All warnings'}
          </button>
          {warnFilterOpen && (
            <div style={{
              position: 'absolute', top: 38, left: 0, zIndex: 40, width: 230, background: '#fff', borderRadius: 10,
              padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
              boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
            }}>
              {nurtureWarnings.map(w => {
                const on = warnSel.includes(w.key)
                const count = scoped.filter(c => c.warnKeys.includes(w.key)).length
                return (
                  <button
                    key={w.key}
                    onClick={() => onToggleWarn(w.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '7px 8px',
                      border: 'none', borderRadius: 6, background: on ? '#e6f1fd' : 'transparent',
                      color: 'rgba(0,0,0,0.87)', fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 15, height: 15, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, color: '#fff',
                      border: `1px solid ${on ? '#0073E6' : '#BDBDBD'}`, background: on ? '#0073E6' : '#fff',
                    }}>
                      {on ? '✓' : ''}
                    </span>
                    <span>{w.label}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: 'rgba(0,0,0,0.54)' }}>{count}</span>
                  </button>
                )
              })}
              <button
                onClick={() => { onClearWarn(); setWarnFilterOpen(false) }}
                style={{
                  marginTop: 2, textAlign: 'left', padding: '7px 8px', border: 'none',
                  borderTop: '1px solid rgba(0,0,0,0.09)', borderRadius: '0 0 6px 6px', background: 'transparent',
                  color: '#0073E6', fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Clear Warning Filter
              </button>
            </div>
          )}
        </div>

        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.54)' }}>
          {rowsForTab.length} in this view · {scoped.length} open
        </span>
      </div>

      <div style={{ padding: '16px 24px 24px' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
          {NURTURE_TABS.map(t => {
            const active = t.key === tab
            const count = filtered.filter(c => matchNurtureTab(c, t.key)).length
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 132,
                  padding: '10px 14px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: "'Open Sans', sans-serif",
                  border: `1px solid ${active ? '#EEEEEE' : 'transparent'}`,
                  borderTop: `3px solid ${active ? '#0073E6' : 'transparent'}`,
                  borderBottom: active ? '1px solid #fff' : '1px solid transparent',
                  borderRadius: '10px 10px 0 0', marginBottom: -1, background: active ? '#fff' : '#F0F0F0',
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: active ? '#0073E6' : count === 0 ? 'rgba(0,0,0,0.38)' : '#262626' }}>
                  {count}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', color: active ? '#003F7F' : 'rgba(0,0,0,0.66)' }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid #EEEEEE', borderRadius: '0 10px 10px 10px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(0,0,0,0.54)', lineHeight: '16px' }}>
              Filter: {activeTab.criteria}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 700, color: '#D32F2F', lineHeight: '18px' }}>
              {activeTab.hint}
            </p>
          </div>
          <NurturingTable tab={tab} rows={rowsForTab} sortKey={sortKey} sortDir={sortDir} onSort={onSort} onInlineSave={onInlineSave} onAction={onAction} />
        </div>
      </div>
    </>
  )
}
