'use client'

import { useSyncExternalStore } from 'react'
import { TOOL_GROUPS, TOOLS, type Tool } from '@/lib/tools'
import { TOOL_ICONS, LockIcon } from '@/components/layout/ToolIcons'

// Greeting uses the viewer's local time, so it's computed in the browser.
// The server render says "Welcome" and the client swaps in the time of day.
function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
const noopSubscribe = () => () => {}

export function Greeting({ firstName }: { firstName: string }) {
  const text = useSyncExternalStore(noopSubscribe, greeting, () => 'Welcome')
  return <>{text}{firstName ? `, ${firstName}` : ''}</>
}

function ToolCard({ tool, locked }: { tool: Tool; locked: boolean }) {
  const Icon = TOOL_ICONS[tool.icon]
  const inner = (
    <>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: locked ? 'var(--bg-subtle)' : tool.bg,
        display: 'grid', placeItems: 'center',
      }}>
        <Icon color={locked ? 'var(--fg-3)' : tool.color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: locked ? 'var(--fg-3)' : 'var(--fg-1)' }}>
          {tool.title}
          {locked && <LockIcon color="var(--fg-3)" />}
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.45, marginTop: 3, opacity: locked ? 0.7 : 1 }}>
          {locked ? 'Restricted. Ask an admin for access.' : tool.description}
        </div>
      </div>
    </>
  )

  const base = {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-1)',
  } as const

  if (locked) {
    return <div title="You don't have access to this tool" style={{ ...base, background: 'transparent', boxShadow: 'none', cursor: 'default' }}>{inner}</div>
  }

  return (
    <a
      href={tool.href}
      style={{ ...base, textDecoration: 'none', transition: 'box-shadow 150ms, border-color 150ms' }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-2)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-1)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {inner}
    </a>
  )
}

// Home page body: one section per tool group, each a grid of compact cards.
export default function ToolGrid({ lockedHrefs }: { lockedHrefs: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {TOOL_GROUPS.map(group => {
        const tools = TOOLS.filter(t => t.group === group.key)
        if (tools.length === 0) return null
        return (
          <section key={group.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--navy-900)', margin: 0 }}>
                {group.label}
              </h2>
              <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{group.description}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {tools.map(t => <ToolCard key={t.href} tool={t} locked={lockedHrefs.includes(t.href)} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
