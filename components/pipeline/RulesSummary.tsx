import type { Opportunity } from '@/lib/types'
import type { RuleDefinition } from '@/lib/rules'
import { FS } from '@/lib/fontSizes'

interface Props {
  rules: RuleDefinition[]
  opps: Opportunity[]
}

export default function RulesSummary({ rules, opps }: Props) {
  if (opps.length === 0) return null

  const ruleStats = rules.map(rule => {
    const failing = opps.filter(rule.check).length
    const healthyPct = Math.round(((opps.length - failing) / opps.length) * 100)
    return { rule, failing, healthyPct, total: opps.length }
  })

  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid rgba(217, 119, 6, 0.25)',
      borderRadius: 8,
      margin: '12px 20px 4px 18px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '7px 14px',
        borderBottom: '1px solid rgba(217, 119, 6, 0.2)',
        background: 'rgba(217, 119, 6, 0.08)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Hygiene rules
        </span>
      </div>
      {ruleStats.map(({ rule, failing, healthyPct, total }, index) => {
        const isClean = failing === 0
        const tone = isClean
          ? { fg: 'var(--green-700)', dot: 'var(--green-500)', countFg: 'var(--green-700)' }
          : { fg: 'var(--red-600)',   dot: 'var(--red-500)',   countFg: 'var(--red-700)' }

        return (
          <div
            key={rule.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              borderTop: index > 0 ? '1px solid rgba(217, 119, 6, 0.12)' : undefined,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{rule.label}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>·</span>
            <span style={{ fontSize: 12, color: tone.countFg, whiteSpace: 'nowrap' }}>
              {isClean ? `${total} of ${total} clean` : `${failing} of ${total} failing`}
            </span>
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12,
              fontWeight: 700,
              color: tone.fg,
            }}>
              {healthyPct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
