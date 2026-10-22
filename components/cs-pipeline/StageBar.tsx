'use client'

import { useRouter } from 'next/navigation'
import { ALL_SQOS, type ArrMetric } from './CsPipelineShell'

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

const SQO_STAGE_NAMES = ['Evaluation', 'Proposal', 'Negotiation', 'Closing']

function formatArr(amount: number): string {
  if (amount === 0) return '$0'
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const k = Math.round(abs / 1_000)
  if (k >= 1_000) return `${sign}$${Math.round(k / 1_000)}m`
  if (k > 0) return `${sign}$${k}k`
  return `${sign}$<1k`
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

  // "All SQOs" tile: Evaluation through Closing. It filters the table like any other stage tile.
  const sqoStats = stats.filter(st => SQO_STAGE_NAMES.includes(st.name))
  const sqoCount = sqoStats.reduce((s, st) => s + st.count, 0)
  const sqoArr   = sqoStats.reduce((s, st) => s + st.totalArr, 0)

  const tiles: (StageStat & { key: string })[] = [
    { key: ALL_SQOS, name: ALL_SQOS, count: sqoCount, totalArr: sqoArr },
    ...stats.map(st => ({ ...st, key: st.name })),
  ]

  return (
    <div>
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

      {/* Stage tabs: same folder-tab style as SQL Handoff. They sit on top of the table card below. */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        {tiles.map(st => {
          const isActive = activeStage === st.key
          const isEmpty = st.count === 0
          return (
            <button
              key={st.key}
              onClick={() => selectStage(isActive ? null : st.key)}
              title={isActive ? 'Click again to show all stages' : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 132,
                padding: '10px 14px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
                borderTop: `3px solid ${isActive ? 'var(--blue-500)' : 'transparent'}`,
                borderBottom: isActive ? '1px solid var(--bg)' : '1px solid transparent',
                borderRadius: '10px 10px 0 0', marginBottom: -1,
                background: isActive ? 'var(--bg)' : '#F0F0F0',
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: isActive ? 'var(--blue-500)' : isEmpty ? 'rgba(0,0,0,0.38)' : '#262626' }}>
                {st.count}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap', color: isActive ? '#003F7F' : 'rgba(0,0,0,0.66)' }}>
                {st.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isEmpty ? 'rgba(0,0,0,0.38)' : 'var(--fg-2)' }}>
                {formatArr(st.totalArr)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
