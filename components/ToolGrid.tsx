'use client'

interface Tool {
  href: string
  title: string
  description: string
  color: string
  bg: string
  locked?: boolean
}

function ToolCard({ tool }: { tool: Tool }) {
  const inner = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: tool.locked ? 'var(--bg-subtle, #f4f6f9)' : tool.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{ width: 20, height: 20, background: tool.locked ? 'var(--fg-3)' : tool.color, borderRadius: 4, opacity: tool.locked ? 0.35 : 0.7 }} />
        </div>
        {tool.locked && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', background: 'var(--bg-subtle, #f4f6f9)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Restricted
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: tool.locked ? 'var(--fg-3)' : 'var(--fg-1)', marginBottom: 6 }}>
        {tool.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: '1.5', opacity: tool.locked ? 0.6 : 1 }}>
        {tool.description}
      </div>
    </>
  )

  if (tool.locked) {
    return (
      <div style={{
        display: 'block', background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 24, boxShadow: 'var(--shadow-1)', cursor: 'default',
      }}>
        {inner}
      </div>
    )
  }

  return (
    <a
      href={tool.href}
      style={{
        display: 'block', background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 24, textDecoration: 'none',
        boxShadow: 'var(--shadow-1)', transition: 'box-shadow 150ms, border-color 150ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-2)'
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-1)'
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
      }}
    >
      {inner}
    </a>
  )
}

export default function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {tools.map(tool => <ToolCard key={tool.href} tool={tool} />)}
    </div>
  )
}
