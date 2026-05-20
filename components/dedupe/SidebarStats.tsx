'use client'

import type { DedupeStats } from '@/lib/dedupe'

interface Props {
  stats: DedupeStats
  sfMerged?: number
  remapped?: number
  markedForDeletion?: number
  showPipeline?: boolean
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--fg-1)' }}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--fg-3)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function SidebarStats({ stats, sfMerged, remapped, markedForDeletion, showPipeline }: Props) {
  const dash = stats.clusters === 0 ? '—' : undefined
  const v = (n: number) => dash ?? n

  return (
    <div>
      <Section title="Summary">
        <StatRow label="Clusters" value={v(stats.clusters)} />
        <StatRow label="Victims to delete" value={v(stats.victims)} color={stats.victims > 0 ? 'var(--orange-700)' : undefined} />
        <StatRow label="Contacts to remap" value={v(stats.contacts)} />
        <StatRow label="SF merge rows" value={v(stats.sfRows)} />
      </Section>

      <Section title="Flags">
        <StatRow label="Conflicts" value={v(stats.conflicts)} color={stats.conflicts > 0 ? 'var(--red-600)' : undefined} />
        <StatRow label="No SF record" value={v(stats.nosf)} color={stats.nosf > 0 ? 'var(--amber-700)' : undefined} />
        <StatRow label="Ignored" value={v(stats.ignored)} />
      </Section>

      {showPipeline && (
        <Section title="Pipeline">
          <StatRow label="SF merged" value={sfMerged ?? 0} />
          <StatRow label="Remapped" value={remapped ?? 0} />
          <StatRow label="Marked for deletion" value={markedForDeletion ?? 0} />
        </Section>
      )}
    </div>
  )
}
