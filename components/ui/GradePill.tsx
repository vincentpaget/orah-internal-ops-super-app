import type { TrafficLight, HealthGrade } from '@/lib/types'

type GradeValue = TrafficLight | HealthGrade | 'Clean'

interface Props {
  grade: GradeValue | null | undefined
  label?: string
}

function gradeStyle(grade: GradeValue): React.CSSProperties {
  switch (grade) {
    case 'Red':
    case 'F':
    case 'D':
      return { background: 'var(--red-50)', color: 'var(--red-700)' }
    case 'Yellow':
    case 'C':
      return { background: 'var(--amber-50)', color: 'var(--amber-700)' }
    case 'Green':
    case 'A':
    case 'B':
    case 'Clean':
      return { background: 'var(--green-50)', color: 'var(--green-700)' }
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--fg-2)' }
  }
}

export default function GradePill({ grade, label }: Props) {
  if (!grade) return <span style={{ color: 'var(--fg-3)', fontSize: 13 }}>—</span>
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      ...gradeStyle(grade),
    }}>
      {label ?? grade}
    </span>
  )
}
