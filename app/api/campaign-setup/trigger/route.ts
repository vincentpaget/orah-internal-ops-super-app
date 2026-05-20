import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

type CampaignType = 'dm' | 'wb' | 'ev'

function buildPayload(type: CampaignType, campaignName: string, summary: Record<string, string>) {
  if (type === 'dm') return {
    'Campaign Name': campaignName,
    'Campaign Description': summary['Campaign description'] || '',
    'Start Date': summary['Start date'] || '',
    'Follow-up Sequence ID': summary['Follow-up sequence ID'] || '',
    'Sequence Start Delay (days)': summary['Sequence start delay (days)'] || '',
    'Conversion Window (days)': summary['Conversion window (days)'] || '',
  }
  if (type === 'wb') return {
    'Campaign Name': campaignName,
    'Campaign Description': summary['Campaign description'] || '',
    'Start Date': summary['Webinar date'] || '',
    'Webinar Name': summary['Webinar name'] || '',
    'Zoom Webinar ID': summary['Zoom webinar ID'] || '',
    'Landing Page Path': summary['Landing page path'] || '',
    'On demand URL': summary['On-demand URL'] || '',
    'On demand email subject': summary['On-demand email subject'] || '',
  }
  if (type === 'ev') return {
    'Campaign Name': campaignName,
    'Campaign Description': summary['Campaign description'] || '',
    'Start Date': summary['Event start date'] || '',
    'End Date': summary['Event end date'] || '',
    'Promotion Start Date': summary['Promotion start date'] || '',
    'Pre-event Sequence IDs': summary['Pre-event sequence IDs'] || '',
    'At-event Sequence IDs': summary['At-event sequence IDs'] || '',
    'Post-event Sequence IDs': summary['Post-event sequence IDs'] || '',
  }
  return {}
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, campaignName, summary } = await req.json()

  const WEBHOOKS: Record<CampaignType, string | undefined> = {
    dm: process.env.N8N_CAMPAIGN_WEBHOOK_DM,
    wb: process.env.N8N_CAMPAIGN_WEBHOOK_WB,
    ev: process.env.N8N_CAMPAIGN_WEBHOOK_EV,
  }

  const webhookUrl = WEBHOOKS[type as CampaignType]
  if (!webhookUrl) {
    return NextResponse.json({ error: type ? `N8N_CAMPAIGN_WEBHOOK_${type.toUpperCase()} not configured` : 'Unknown campaign type' }, { status: 400 })
  }

  try {
    const payload = buildPayload(type, campaignName, summary)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { message: text } }
    return NextResponse.json({ status: 'success', n8nResponse: data })
  } catch (err) {
    return NextResponse.json({ status: 'error', error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
