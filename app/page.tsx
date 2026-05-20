import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJWT } from '@/lib/session'
import AppShell from '@/components/layout/AppShell'
import ToolGrid from '@/components/ToolGrid'

const TOOLS = [
  {
    href: '/pipeline',
    title: 'Pipeline Review',
    description: 'Monitor and improve sales pipeline health and hygiene across your team.',
    color: 'var(--blue-500)',
    bg: 'var(--blue-50)',
  },
  {
    href: '/campaign-setup',
    title: 'Campaign Setup',
    description: 'AI-assisted campaign creation that triggers HubSpot and Salesforce workflows via n8n.',
    color: 'var(--orange-700)',
    bg: 'var(--orange-50)',
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
]

const TOOL_ALLOW_ENV: Record<string, string> = {
  '/pipeline':       'PIPELINE_ALLOW',
  '/dedupe':         'DEDUPE_ALLOW',
  '/event-leads':    'EVENT_LEADS_ALLOW',
  '/campaign-setup': 'CAMPAIGN_SETUP_ALLOW',
}

function isLocked(href: string, email: string): boolean {
  const envKey = TOOL_ALLOW_ENV[href]
  if (!envKey) return false
  const allowed = (process.env[envKey] ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.length > 0 && !allowed.includes(email)
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value || '')

  if (!session) {
    redirect('/login')
  }

  const userName = (session.name as string) || (session.email as string) || 'User'
  const email = (session.email as string | undefined)?.toLowerCase() ?? ''

  const tools = TOOLS.map(tool => ({
    ...tool,
    locked: isLocked(tool.href, email),
  }))

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

        <ToolGrid tools={tools} />
      </div>
    </AppShell>
  )
}
