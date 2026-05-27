'use client'

import { useRouter } from 'next/navigation'
import type { ArrMetric } from './CsPipelineShell'
import { FS } from '@/lib/fontSizes'

interface StageStat {
  name: string
  count: number
  totalArr: number
}

interface Props {
  stats: StageStat[]
  activeStage: string | null
  filterSearch: string
  metric: ArrMetric
  onMetricChange: (m: ArrMetric) => void
}

function formatArr(amount: number): string {
  if (amount === 0) return 'NZ$0'
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const k = Math.round(abs / 1_000)
  if (k >= 1_000) return `${sign}NZ$${Math.round(k / 1_000)}m`
  if (k > 0) return `${sign}NZ$${k}k`
  return `${sign}NZ$<1k`
}

export default function StageBar({ stats, activeStage, filterSearch, metric, onMetricChange }: Props) {
  const router = useRouter()

  function selectStage(stage: string | null) {
    const params = new URLSearchParams(filterSearch)
    if (stage) {
      params.set('stage', stage)
    } else {
      params.delete('stage')
    }
    router.push(`/cs-pipeline?${params.toString()}`)
  }

  // "All Open Stages" tile: exclude any stage whose name contains "Closed"
  const openStats = stats.filter(st => !st.name.includes('Closed'))
  const openCount = openStats.reduce((s, st) => s + st.count, 0)
  const openArr   = openStats.reduce((s, st) => s + st.totalArr, 0)

  const tiles: (StageStat & { key: string | null })[] = [
    { key: null, name: 'All Open Stages', count: openCount, totalArr: openArr },
    ...stats.map(st => ({ ...st, key: st.name })),
  ]

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Metric toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{
          display: 'inline-flex', gap: 2, padding: 2,
          borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)',
        }}>
          {(['net_arr', 'total_arr'] as ArrMetric[]).map(m => {
            const active = metric === m
            return (
              <button
                key={m}
                onClick={() => onMetricChange(m)}
                style={{
                  padding: '4px 12px', borderRadius: 4, border: 'none',
                  background: active ? 'var(--navy-900)' : 'transparent',
                  color: active ? '#fff' : 'var(--fg-2)',
                  fontWeight: active ? 600 : 500, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 120ms, color 120ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {m === 'net_arr' ? 'Net ARR' : 'Total ARR'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stage tiles */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
          {tiles.map(st => {
            const isActive = st.key === null ? activeStage === null : activeStage === st.name
            const isEmpty = st.count === 0
            return (
              <button
                key={st.key ?? '__all__'}
                onClick={() => { if (!isActive) selectStage(st.key) }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  padding: '12px 16px', borderRadius: 8,
                  border: `1px solid ${isActive ? 'var(--navy-900)' : 'var(--border)'}`,
                  background: isActive ? 'var(--navy-900)' : 'var(--bg)',
                  color: isActive ? '#fff' : isEmpty ? 'var(--fg-3)' : 'var(--fg-2)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  minWidth: 110, transition: 'background 120ms, border-color 120ms, color 120ms',
                  flexShrink: 0, opacity: isEmpty && !isActive && st.key !== null ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  }
                }}
              >
                <span style={{ ...FS.badge, fontWeight: 700, color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {st.name}
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', color: isActive ? '#fff' : isEmpty ? 'var(--fg-3)' : 'var(--fg-1)' }}>
                  {formatArr(st.totalArr)}
                </span>
                <span style={{ ...FS.badge, color: isActive ? 'rgba(255,255,255,0.65)' : 'var(--fg-3)' }}>
                  {st.count} deal{st.count !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
