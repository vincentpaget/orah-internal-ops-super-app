import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJWT } from '@/lib/session'
import AppShell from '@/components/layout/AppShell'

const TOOLS = [
  {
    href: '/pipeline',
    title: 'Pipeline Review',
    description: 'Monitor and improve sales pipeline health and hygiene across your team.',
    color: 'var(--blue-500)',
    bg: 'var(--blue-50)',
  },
  {
    href: '/dedupe',
    title: 'CRM Dedupe',
    description: 'Identify and merge duplicate company records across Salesforce and HubSpot.',
    color: 'var(--purple-500)',
    bg: 'var(--purple-50)',
  },
  {
    href: '/event-leads',
    title: 'Event Lead Pipeline',
    description: 'Clean and enrich event attendee lists with AI before importing to CRM.',
    color: 'var(--green-600)',
    bg: 'var(--green-50)',
  },
  {
    href: '/campaign-setup',
    title: 'Campaign Setup',
    description: 'AI-assisted campaign creation that triggers HubSpot and Salesforce workflows via n8n.',
    color: 'var(--orange-700)',
    bg: 'var(--orange-50)',
  },
]

export default async function HomePage() {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value || '')

  if (!session) {
    redirect('/login')
  }

  const userName = (session.name as string) || (session.email as string) || 'User'

  return (
    <AppShell userName={userName}>
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>
            Orah Internal Ops Hub
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-3)' }}>
            Internal tools for the Orah Revenue team. Select a tool to get started.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {TOOLS.map(tool => (
            <a
              key={tool.href}
              href={tool.href}
              style={{
                display: 'block',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '24px',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-1)',
                transition: 'box-shadow 150ms, border-color 150ms',
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
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: tool.bg,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{ width: 20, height: 20, background: tool.color, borderRadius: 4, opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>
                {tool.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: '1.5' }}>
                {tool.description}
              </div>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
