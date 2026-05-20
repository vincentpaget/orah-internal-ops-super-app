'use client'

interface Props {
  pairs: number
  totalRecords: number
  clusters: number
  conflicts: number
}

function RSItem({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: color ?? 'var(--fg-1)' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 1, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

export default function ReviewStatsBar({ pairs, totalRecords, clusters, conflicts }: Props) {
  const div = <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 2px' }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 18px', marginBottom: 12, textAlign: 'center' }}>
      <RSItem value={pairs} label="Duplicate pairs" />
      {div}
      <RSItem value={totalRecords} label="Total unique records" />
      {div}
      <RSItem value={clusters} label="Clusters" />
      {div}
      <RSItem value={conflicts} label="Conflicts remaining" color={conflicts > 0 ? 'var(--red-600)' : undefined} />
    </div>
  )
}
