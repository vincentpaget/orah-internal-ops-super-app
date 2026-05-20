import { WebClient } from '@slack/web-api'
import type { RepRow } from './types'

let _slack: WebClient | null = null
function getSlack() {
  if (!_slack) _slack = new WebClient(process.env.SLACK_BOT_TOKEN)
  return _slack
}

export async function slackUserIdForEmail(email: string): Promise<string | null> {
  try {
    const res = await getSlack().users.lookupByEmail({ email })
    return (res.user?.id as string) ?? null
  } catch {
    return null
  }
}

export function buildLeaderboardBlocks(
  rows: RepRow[],
  mentionById: Map<string, string>,
  periodLabel: string,
  dashboardUrl: string
) {
  const totalOpen    = rows.reduce((s, r) => s + r.openOpps, 0)
  const totalFlagged = rows.reduce((s, r) => s + r.flaggedCount, 0)
  const teamScore    = totalOpen > 0
    ? Math.round(((totalOpen - totalFlagged) / totalOpen) * 100)
    : 100
  const scoreEmoji = teamScore >= 80 ? '✅' : teamScore >= 60 ? '⚠️' : '🔴'

  const medals = ['🥇', '🥈', '🥉']
  const dateStr = new Date().toLocaleDateString('en-NZ', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const repRows = rows.map((row, i) => {
    const uid  = mentionById.get(row.repId)
    const name = uid ? `<@${uid}>` : `*${row.repName}*`
    const score =
      row.healthPct >= 80 ? `${row.healthPct}% ✅` :
      row.healthPct >= 60 ? `${row.healthPct}% ⚠️` :
                            `${row.healthPct}% 🔴`
    const rank = i < 3 ? medals[i] : `${i + 1}.`
    return {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `${rank}  ${name}` },
        { type: 'mrkdwn', text: `*Score:* ${score}     *Open:* ${row.openOpps}     *Flagged:* ${row.flaggedCount}` },
      ],
    }
  })

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Pipeline Hygiene Leaderboard', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${periodLabel}  ·  ${dateStr}` }],
    },
    { type: 'divider' },
    // Hero metrics
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Team hygiene score*\n${teamScore}% ${scoreEmoji}` },
        { type: 'mrkdwn', text: `*Opportunities flagged*\n${totalFlagged} of ${totalOpen} open` },
      ],
    },
    { type: 'divider' },
    // Column headers
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Team member*' },
        { type: 'mrkdwn', text: '*Hygiene details*' },
      ],
    },
    // One row per rep
    ...repRows,
    { type: 'divider' },
    {
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'View full dashboard →', emoji: true },
        url: dashboardUrl,
      }],
    },
  ]
}

export async function postLeaderboard(
  rows: RepRow[],
  emailByRepId: Map<string, string>,
  periodLabel: string,
) {
  const slack = getSlack()

  const mentionById = new Map<string, string>()
  await Promise.all(
    [...emailByRepId.entries()].map(async ([repId, email]) => {
      const uid = await slackUserIdForEmail(email)
      if (uid) mentionById.set(repId, uid)
    })
  )

  const base = (process.env.DASHBOARD_URL ?? 'http://localhost:3001').replace(/\/pipeline\/?$/, '')
  const dashboardUrl = `${base}/pipeline`

  const blocks = buildLeaderboardBlocks(rows, mentionById, periodLabel, dashboardUrl)

  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID!,
    text: '📊 Pipeline Hygiene Leaderboard',
    blocks,
  })
}
