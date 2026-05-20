import { NextResponse } from 'next/server'
import { enrichOpportunity } from '@/lib/flags'
import { computeRepRows, getPeriodRange } from '@/lib/pipeline'
import { postLeaderboard } from '@/lib/slack'
import { OPEN_STAGES } from '@/lib/types'

async function handler(req: Request) {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
    return NextResponse.json({ error: 'Slack not configured — set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'this_quarter'
    const { start, end, label } = getPeriodRange(period)

    const { fetchOpportunities } = await import('@/lib/salesforce')
    const raw = await fetchOpportunities(start, end)
    const opps = raw.map(enrichOpportunity)
    const rows = computeRepRows(opps)

    const emailByRepId = new Map(
      opps
        .filter(o => OPEN_STAGES.includes(o.StageName) && o['Owner.Email'])
        .map(o => [o['Owner.Id'], o['Owner.Email']!])
    )

    await postLeaderboard(rows, emailByRepId, label)
    return NextResponse.json({ ok: true, reps: rows.length })
  } catch (err) {
    console.error('[send-leaderboard]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const POST = handler
export const GET = handler
