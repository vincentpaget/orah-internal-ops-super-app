import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJWT } from '@/lib/session'
import { lockedToolHrefs } from '@/lib/tools'
import AppShell from '@/components/layout/AppShell'
import ToolGrid, { Greeting } from '@/components/ToolGrid'

export default async function HomePage() {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value || '')

  if (!session) {
    redirect('/login')
  }

  const userName = (session.name as string) || (session.email as string) || 'User'
  const email = (session.email as string | undefined) ?? ''
  const firstName = ((session.name as string | undefined) ?? '').split(' ')[0]
  const lockedHrefs = lockedToolHrefs(email)

  return (
    <AppShell userName={userName} lockedHrefs={lockedHrefs}>
      <div style={{ maxWidth: 1600 }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>
            <Greeting firstName={firstName} />
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-3)' }}>
            Internal tools for the Orah Revenue and Customer Success teams.
          </p>
        </div>

        <ToolGrid lockedHrefs={lockedHrefs} />
      </div>
    </AppShell>
  )
}
