'use client'

import { CURRENCIES, PLATFORM_LABELS, type CurrencyCode, type Platform } from '@/lib/pricing/data'
import styles from './pricing.module.css'

export function CurrencySelect({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(e.target.value as CurrencyCode)}
      aria-label="Currency"
      style={{
        padding: '7px 12px',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
        background: 'var(--bg)',
        color: 'var(--navy-900)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {CURRENCIES.map(c => (
        <option key={c.code} value={c.code}>
          {c.flag} {c.code} ({c.symbol})
        </option>
      ))}
    </select>
  )
}

export function PlatformToggle({ value, onChange }: { value: Platform; onChange: (p: Platform) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => {
        const active = p === value
        return (
          <button
            key={p}
            type="button"
            className={styles.toggleBtn}
            onClick={() => onChange(p)}
            style={{
              padding: '9px 22px',
              border: `2px solid ${active ? 'var(--navy-900)' : 'var(--border-strong)'}`,
              borderRadius: 8,
              background: active ? 'var(--navy-900)' : 'var(--bg)',
              color: active ? '#fff' : 'var(--navy-900)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {PLATFORM_LABELS[p]} Platform
          </button>
        )
      })}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--fg-2)', margin: '4px 0 0' }}>{subtitle}</p>
      </div>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}
