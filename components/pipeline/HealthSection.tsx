import type { HealthGrade, Opportunity } from '@/lib/types'
import { SQO_RULES, SAO_RULES } from '@/lib/rules'
import GradePill from '@/components/ui/GradePill'
import RulesSummary from './RulesSummary'
import SQOHealthTable from './SQOHealthTable'
import SAOHealthTable from './SAOHealthTable'

interface Props {
  title: string
  type: 'sqo' | 'sao'
  opps: Opportunity[]
  grade: HealthGrade
}

export default function HealthSection({ title, type, opps, grade }: Props) {
  const failing = opps.filter(o => o.flags.length > 0)
  const summary = failing.length === 0
    ? 'All clean'
    : `${failing.length} of ${opps.length} need attention`

  const rules = type === 'sqo' ? SQO_RULES : SAO_RULES

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 24,
      marginBottom: 24,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{title}</h2>
        <GradePill grade={grade} />
        <span style={{ fontSize: 14, color: 'var(--fg-2)' }}>{summary}</span>
      </header>
      <RulesSummary rules={rules} opps={opps} />
      {type === 'sqo' ? <SQOHealthTable opps={opps} /> : <SAOHealthTable opps={opps} />}
    </section>
  )
}
