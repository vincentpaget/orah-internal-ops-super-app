import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJWT } from '@/lib/session'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value || '')

  if (!session) {
    redirect('/login')
  }

  const userName = (session.name as string) || (session.email as string) || 'User'

  return <AppShell userName={userName}>{children}</AppShell>
}
