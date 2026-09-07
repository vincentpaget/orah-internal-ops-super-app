import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

type CampaignType = 'dm' | 'wb' | 'ev'

// Built directly from the original form values (`fd`) submitted by the user — the AI only ever
// supplies campaignName and fd.desc, so every other field here is guaranteed to be exactly what
// was typed into the form, never a re-derived value that could drift from an LLM response.
function buildPayload(type: CampaignType, campaignName: string, fd: Record<string, string>) {
  if (type === 'dm') return {
    'Campaign Name': campaignName,
    'Campaign Description': fd.desc || '',
    'Start Date': fd.start || '',
    'Follow-up Sequence ID': fd.seqid || '',
    'Sequence Start Delay (days)': fd.delay || '',
    'Conversion Window (days)': fd.conv || '',
  }
  if (type === 'wb') return {
    'Campaign Name': campaignName,
    'Campaign Description': fd.desc || '',
    'Start Date': fd.date || '',
    'Webinar Name': fd.name || '',
    'Zoom Webinar ID': fd.zoomid || '',
    'Landing Page Path': fd.lpath || '',
    'On demand URL': fd.odurl || '',
    'On demand email subject': fd.odsub || `Webinar Recording: ${fd.name || ''}`,
  }
  if (type === 'ev') return {
    'Campaign Name': campaignName,
    'Campaign Description': fd.desc || '',
    'Start Date': fd.start || '',
    'End Date': fd.end || '',
    'Promotion Start Date': fd.promo || '',
    'Pre-event Sequence IDs': fd.pre || '',
    'At-event Sequence IDs': fd.at || '',
    'Post-event Sequence IDs': fd.post || '',
  }
  return {}
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, campaignName, fd } = await req.json()

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
    const payload = buildPayload(type, campaignName, fd)
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
