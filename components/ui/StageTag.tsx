import type { StageName } from '@/lib/types'

interface Props {
  stage: string
  short?: boolean
}

const SHORT_LABELS: Record<string, string> = {
  Qualifying: 'SQL',
  Nurturing: 'SAO',
  Evaluation: 'Eval',
  Proposal: 'Prop',
  Negotiation: 'Negot',
  Closing: 'Closing',
}

const STYLES: Record<string, React.CSSProperties> = {
  Qualifying:   { background: 'var(--purple-50)', color: 'var(--purple-500)' },
  Nurturing:    { background: 'var(--orange-50)', color: 'var(--orange-700)' },
  Evaluation:   { background: 'var(--blue-50)',   color: 'var(--blue-700)' },
  Proposal:     { background: 'var(--blue-50)',   color: 'var(--blue-700)' },
  Negotiation:  { background: 'var(--blue-50)',   color: 'var(--blue-700)' },
  Closing:      { background: 'var(--green-50)',  color: 'var(--green-700)' },
  'Closed Won': { background: 'var(--green-50)',  color: 'var(--green-700)' },
  'Closed Lost':{ background: 'var(--bg-subtle)', color: 'var(--fg-3)' },
}

export default function StageTag({ stage, short }: Props) {
  const style = STYLES[stage as StageName] ?? { background: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  const label = short ? (SHORT_LABELS[stage] ?? stage) : stage
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {label}
    </span>
  )
}
