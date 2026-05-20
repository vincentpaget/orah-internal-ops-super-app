import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.N8N_WEBHOOK_EVENT_LEADS
  if (!webhookUrl) return NextResponse.json({ error: 'N8N_WEBHOOK_EVENT_LEADS not configured' }, { status: 500 })

  const { event_name, lead_list_csv_string, lead_count } = await req.json()
  if (!lead_list_csv_string) return NextResponse.json({ error: 'lead_list_csv_string required' }, { status: 400 })

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name, lead_list_csv_string, lead_count }),
    })

    if (!n8nRes.ok) {
      const err = await n8nRes.text()
      return NextResponse.json({ error: `n8n returned ${n8nRes.status}: ${err}` }, { status: 502 })
    }

    const data = await n8nRes.json().catch(() => ({}))
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
