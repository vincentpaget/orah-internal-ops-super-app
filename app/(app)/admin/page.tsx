const TOOLS = [
  { label: 'Pipeline Review',     envKey: 'PIPELINE_ALLOW',      color: 'var(--blue-500)',   bg: 'var(--blue-50)' },
  { label: 'CRM Dedupe',          envKey: 'DEDUPE_ALLOW',         color: 'var(--purple-500)', bg: 'var(--purple-50)' },
  { label: 'Event Lead Pipeline', envKey: 'EVENT_LEADS_ALLOW',    color: 'var(--green-600)',  bg: 'var(--green-50)' },
  { label: 'Campaign Setup',      envKey: 'CAMPAIGN_SETUP_ALLOW', color: 'var(--orange-700)', bg: 'var(--orange-50)' },
]

function getAllowList(envKey: string): string[] {
  return (process.env[envKey] ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export default async function AdminPage() {
  return (
    <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>
            Admin
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-3)' }}>
            Settings and access control for each tool. Edit the <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>.env</code> file to update permissions.
          </p>
        </div>

        <section>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Permissions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {TOOLS.map(({ label, envKey, color, bg }) => {
              const allowList = getAllowList(envKey)
              return (
                <div key={envKey} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg)', gap: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{envKey}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flexShrink: 0, maxWidth: 340 }}>
                    {allowList.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic', paddingTop: 2 }}>All authenticated users</span>
                    ) : allowList.map(email => (
                      <span key={email} style={{ fontSize: 12, fontWeight: 500, color, background: bg, border: `1px solid ${color}22`, borderRadius: 20, padding: '3px 10px' }}>
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
  )
}
