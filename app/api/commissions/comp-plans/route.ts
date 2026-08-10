import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { getCommissionsPermissions } from '@/lib/commissions/permissions'
import { fetchCompPlanSettings, saveCompPlanCell } from '@/lib/commissions/compPlanStore'
import type { StoredCompPlan } from '@/lib/commissions/types'

export async function GET() {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await fetchCompPlanSettings()
    return NextResponse.json({ settings })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!getCommissionsPermissions(session).isAdmin) {
    return NextResponse.json({ error: 'Read-only access — you do not have permission to edit comp plans' }, { status: 403 })
  }

  const body = await req.json()
  const { cellId, value } = body as { cellId?: string; value?: StoredCompPlan }

  if (!cellId || value === undefined) {
    return NextResponse.json({ error: 'Missing cellId or value' }, { status: 400 })
  }

  try {
    await saveCompPlanCell(cellId, value)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
