import { shortDate } from '@/lib/formatters'

interface Props {
  date: string | null | undefined
  noWarning?: boolean
}

export default function DatePill({ date, noWarning }: Props) {
  if (!date) return <span style={{ color: 'var(--fg-3)' }}>—</span>

  const diffDays = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
  const formatted = shortDate(date)

  let status: string | null = null
  if (!noWarning) {
    if (diffDays < 0) {
      status = `❌ ${Math.abs(diffDays)}d past due`
    } else if (diffDays <= 30) {
      status = `⚠️ due in ${diffDays}d`
    }
  }

  return (
    <span style={{ fontSize: 13, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {formatted}
      {status && (
        <span style={{ marginLeft: 6, color: diffDays < 0 ? 'var(--red-600)' : 'var(--orange-600)', fontWeight: 500 }}>
          ({status})
        </span>
      )}
    </span>
  )
}
