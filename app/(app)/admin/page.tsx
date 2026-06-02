const TOOLS = [
  { label: 'Pipeline Review',  envKey: 'PIPELINE_ALLOW',      color: 'var(--blue-500)',   bg: 'var(--blue-50)' },
  { label: 'CS Pipeline',      envKey: 'CS_PIPELINE_ALLOW',   color: '#0891b2',           bg: '#e0f7fa' },
  { label: 'CRM Dedupe',       envKey: 'DEDUPE_ALLOW',        color: 'var(--purple-500)', bg: 'var(--purple-50)' },
  { label: 'Event Leads',      envKey: 'EVENT_LEADS_ALLOW',   color: 'var(--green-600)',  bg: 'var(--green-50)' },
  { label: 'Campaign Setup',   envKey: 'CAMPAIGN_SETUP_ALLOW', color: 'var(--orange-700)', bg: 'var(--orange-50)' },
]

const CRONS = [
  {
    name: 'Pipeline Review Leaderboard',
    description: 'Posts the weekly pipeline hygiene leaderboard to Slack',
    path: '/api/slack/send-leaderboard',
    schedule: '0 14 * * 1-5',
    humanSchedule: 'Weekdays at 2:00 PM UTC',
    channel: '#sales_marketing',
  },
  {
    name: 'CS Pipeline Hygiene',
    description: 'Posts next-90-day CS pipeline hygiene scores per rep to Slack',
    path: '/api/slack/send-cs-hygiene',
    schedule: '0 14 * * 1-5',
    humanSchedule: 'Weekdays at 2:00 PM UTC',
    channel: '#success_ops',
  },
]

function getAllowList(envKey: string): string[] {
  return (process.env[envKey] ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

const CODE: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  background: 'var(--bg-subtle)',
  padding: '1px 5px',
  borderRadius: 4,
}

import type React from 'react'

export default async function AdminPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>
          Admin
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-3)' }}>
          Settings and access control for each tool. Edit the <code style={CODE}>.env</code> file to update permissions.
        </p>
      </div>

      {/* Permissions */}
      <section style={{ marginBottom: 40 }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flexShrink: 0, maxWidth: 380 }}>
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

      {/* Cron Jobs */}
      <section>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Scheduled Alerts (Cron Jobs)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
          Configured in <code style={CODE}>vercel.json</code>. All times are UTC. Cron jobs only run in production.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {CRONS.map((cron) => (
            <div key={cron.path} style={{ padding: '16px 20px', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{cron.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 3 }}>{cron.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>{cron.humanSchedule}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>Slack: <strong>{cron.channel}</strong></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  Path: <code style={CODE}>{cron.path}</code>
                </span>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  Schedule: <code style={CODE}>{cron.schedule}</code>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
