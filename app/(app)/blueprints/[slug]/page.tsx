import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findBlueprint } from '@/lib/blueprints'

export async function generateMetadata({ params }: PageProps<'/blueprints/[slug]'>): Promise<Metadata> {
  const blueprint = findBlueprint((await params).slug)
  return { title: `${blueprint?.title ?? 'Blueprint'} · GTM Blueprints · Orah Ops Hub` }
}

export default async function BlueprintPage({ params }: PageProps<'/blueprints/[slug]'>) {
  const blueprint = findBlueprint((await params).slug)
  if (!blueprint) notFound()
  const src = `/api/blueprints/${blueprint.slug}`

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '10px 24px', minHeight: 53, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--navy-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {blueprint.title}
        </span>
        <a href={src} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-500)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Open full screen ↗
        </a>
      </div>
      <iframe
        key={blueprint.slug}
        src={src}
        title={blueprint.title}
        style={{ flex: 1, width: '100%', border: 'none', background: 'var(--bg)' }}
      />
    </>
  )
}
