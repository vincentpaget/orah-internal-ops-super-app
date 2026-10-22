import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { TOOLS, isToolLocked } from '@/lib/tools'

// Fields the All Deals table may write back to Salesforce. Anything else is rejected.
const EDITABLE_FIELDS = new Set([
  'StageName', 'Type', 'Category__c', 'CloseDate', 'NextStep',
  'Expansion_Notes__c', 'Renewal_Risk_Notes__c', 'Manager_Review_Notes__c', 'Initial_Meeting_Outcome__c',
])

const REQUIRED: Record<string, string> = { StageName: 'Stage', CloseDate: 'Close Date' }

// Saves one row's edited fields to an Opportunity in a single update.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tool = TOOLS.find(t => t.href === '/cs-pipeline')
  if (tool && isToolLocked(tool, (session.email as string | undefined) ?? '')) {
    return NextResponse.json({ error: 'You don\'t have access to this tool' }, { status: 403 })
  }

  const { opportunityId, fields } = await req.json() as { opportunityId?: string; fields?: Record<string, unknown> }
  if (!opportunityId || !/^006[A-Za-z0-9]{12,15}$/.test(opportunityId)) {
    return NextResponse.json({ error: 'Missing or invalid opportunityId' }, { status: 400 })
  }
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No changes to save' }, { status: 400 })
  }

  const update: Record<string, string | null> = {}
  for (const [field, value] of Object.entries(fields)) {
    if (!EDITABLE_FIELDS.has(field)) {
      return NextResponse.json({ error: `${field} can't be edited` }, { status: 400 })
    }
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 })
    }
    if (REQUIRED[field] && !value) {
      return NextResponse.json({ error: `${REQUIRED[field]} can't be empty` }, { status: 400 })
    }
    if (field === 'CloseDate' && !/^\d{4}-\d{2}-\d{2}$/.test(value as string)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    update[field] = value === '' ? null : value
  }

  try {
    const { updateOpportunity } = await import('@/lib/salesforce')
    await updateOpportunity(opportunityId, update)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
