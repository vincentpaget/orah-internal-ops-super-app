import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { getCommissionsPermissions } from '@/lib/commissions/permissions'
import { fetchSettingsConfig, saveSettingsQuarters, saveSettingsReps } from '@/lib/commissions/compPlanStore'

export async function GET() {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await fetchSettingsConfig()
    return NextResponse.json(config)
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
    return NextResponse.json({ error: 'Read-only access — you do not have permission to edit settings' }, { status: 403 })
  }

  const body = await req.json()
  const { reps, quarters } = body as { reps?: string[]; quarters?: string[] }

  if (!Array.isArray(reps) && !Array.isArray(quarters)) {
    return NextResponse.json({ error: 'Missing reps or quarters array' }, { status: 400 })
  }

  try {
    if (Array.isArray(reps)) await saveSettingsReps(reps)
    if (Array.isArray(quarters)) await saveSettingsQuarters(quarters)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
