import { MOCK_SQL_HANDOFF_OPPORTUNITIES, MOCK_SQL_DASHBOARD_HISTORY } from '@/lib/sql-handoff/mockData'
import { quarterStart } from '@/lib/sql-handoff/logic'
import SqlHandoffApp from '@/components/sql-handoff/SqlHandoffApp'

export default async function SqlHandoffPage() {
  let sfError: string | null = null
  let opportunities = MOCK_SQL_HANDOFF_OPPORTUNITIES
  let history = MOCK_SQL_DASHBOARD_HISTORY

  if (process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN) {
    try {
      const { fetchSqlHandoffOpportunities, fetchSqlDashboardHistory } = await import('@/lib/sql-handoff/salesforce')
      const qStart = quarterStart().toISOString().slice(0, 10)
      ;[opportunities, history] = await Promise.all([
        fetchSqlHandoffOpportunities(),
        fetchSqlDashboardHistory(qStart),
      ])
    } catch (err) {
      sfError = err instanceof Error ? err.message : 'Unknown Salesforce error'
    }
  }

  return (
    <div>
      {sfError && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'var(--red-50)',
          border: '1px solid rgba(201,17,31,0.2)',
          color: 'var(--red-700)',
          fontSize: 13,
        }}>
          <strong>Salesforce connection error:</strong> {sfError} — showing mock data.
        </div>
      )}

      <SqlHandoffApp opportunities={opportunities} history={history} />
    </div>
  )
}
