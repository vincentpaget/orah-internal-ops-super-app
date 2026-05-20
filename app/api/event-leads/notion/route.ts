import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

const NOTION_VERSION = '2022-06-28'

async function notionGet(path: string, token: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
  })
  if (!res.ok) throw new Error(`Notion API error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function notionPost(path: string, body: unknown, token: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Notion API error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function findEventInteractionLogDb(token: string): Promise<string> {
  const data = await notionPost('/search', { query: 'Event Interaction Log', filter: { property: 'object', value: 'database' } }, token)
  const match = (data.results || []).find((r: { title?: { plain_text: string }[] }) =>
    r.title?.map((t: { plain_text: string }) => t.plain_text).join('').trim() === 'Event Interaction Log'
  )
  if (!match) throw new Error('Event Interaction Log database not found — ensure the Orah N8N integration has access to it in Notion.')
  return match.id.replace(/-/g, '')
}

function extractPageId(url: string): string {
  const patterns = [
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    /([a-f0-9]{32})(?:[?#&/]|$)/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1].replace(/-/g, '')
  }
  throw new Error(`Could not extract page ID from URL: ${url}`)
}

function extractProp(prop: Record<string, unknown> | undefined): string {
  if (!prop) return ''
  switch (prop.type) {
    case 'title':        return (prop.title as { plain_text: string }[])?.map(t => t.plain_text).join('') || ''
    case 'rich_text':    return (prop.rich_text as { plain_text: string }[])?.map(t => t.plain_text).join('') || ''
    case 'email':        return (prop.email as string) || ''
    case 'url':          return (prop.url as string) || ''
    case 'select':       return (prop.select as { name: string })?.name || ''
    case 'multi_select': return (prop.multi_select as { name: string }[])?.map(s => s.name).join(', ') || ''
    case 'checkbox':     return prop.checkbox ? '__YES__' : '__NO__'
    case 'date':         return (prop.date as { start: string })?.start || ''
    case 'number':       return prop.number?.toString() || ''
    case 'formula': {
      const f = prop.formula as { type: string; string?: string; number?: number }
      if (f?.type === 'string') return f.string || ''
      if (f?.type === 'number') return f.number?.toString() || ''
      return ''
    }
    default: return ''
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.NOTION_TOKEN
  if (!token) return NextResponse.json({ error: 'NOTION_TOKEN not configured' }, { status: 500 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url parameter required' }, { status: 400 })

  try {
    const pageId = extractPageId(url)
    const page = await notionGet(`/pages/${pageId}`, token)
    const props = page.properties || {}

    const sf_campaign_id = extractProp(props['SF Campaign ID'] || props['sf_campaign_id']) || ''
    const sf_campaign_name = extractProp(
      props['SF Campaign Name'] || Object.values(props).find((p: unknown) => (p as Record<string,unknown>).type === 'title')
    ) || ''

    const sourceDbId = await findEventInteractionLogDb(token)
    let allRows: unknown[] = []
    let cursor: string | undefined = undefined

    do {
      const body = {
        filter: { property: 'Campaign', relation: { contains: pageId } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }
      const data = await notionPost(`/databases/${sourceDbId}/query`, body, token)
      allRows = allRows.concat(data.results || [])
      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    if (!allRows.length) {
      return NextResponse.json({ sf_campaign_id, sf_campaign_name, rows: [], warning: 'No rows found for this campaign' })
    }

    const WANTED = ['Person Name', 'First Name', 'Last Name', 'Job Title', 'Email', 'School', 'Status', 'Notes', 'School Website', 'Assign To Email']
    const rows = allRows.map(page => {
      const p = (page as { properties: Record<string, Record<string, unknown>> }).properties || {}
      const row: Record<string, string> = {}
      for (const field of WANTED) row[field] = extractProp(p[field]) || ''
      return row
    })

    return NextResponse.json({ sf_campaign_id, sf_campaign_name, rows })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
