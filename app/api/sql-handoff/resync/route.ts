import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { quarterStart } from '@/lib/sql-handoff/logic'

export async function GET() {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SF_USERNAME && !process.env.SF_ACCESS_TOKEN) {
    const { MOCK_SQL_HANDOFF_OPPORTUNITIES, MOCK_SQL_DASHBOARD_HISTORY } = await import('@/lib/sql-handoff/mockData')
    return NextResponse.json({ success: true, opportunities: MOCK_SQL_HANDOFF_OPPORTUNITIES, history: MOCK_SQL_DASHBOARD_HISTORY })
  }

  try {
    const { fetchSqlHandoffOpportunities, fetchSqlDashboardHistory } = await import('@/lib/sql-handoff/salesforce')
    const qStart = quarterStart().toISOString().slice(0, 10)
    const [opportunities, history] = await Promise.all([
      fetchSqlHandoffOpportunities(),
      fetchSqlDashboardHistory(qStart),
    ])
    return NextResponse.json({ success: true, opportunities, history })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
