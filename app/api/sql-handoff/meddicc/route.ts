import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { MEDDICC_FIELDS } from '@/lib/sql-handoff/logic'
import type { MeddiccKey } from '@/lib/sql-handoff/types'

const GRADES = new Set(['Red', 'Yellow', 'Green'])

// Saves MEDDICC grades and rep notes from the MEDDICC pop-up. Only the elements sent are written,
// and only grade + notes fields — nothing else on the opportunity changes.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { opportunityId, meddicc } = await req.json() as {
    opportunityId?: string
    meddicc?: Partial<Record<MeddiccKey, { grade?: string; notes?: string }>>
  }
  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }
  if (!meddicc || typeof meddicc !== 'object') {
    return NextResponse.json({ error: 'No MEDDICC changes sent' }, { status: 400 })
  }

  const fields: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(meddicc)) {
    const m = MEDDICC_FIELDS.find(f => f.key === key)
    if (!m || !entry) return NextResponse.json({ error: `Unknown MEDDICC element: ${key}` }, { status: 400 })
    if (entry.grade !== undefined) {
      if (!GRADES.has(entry.grade)) return NextResponse.json({ error: `Invalid grade for ${m.label}` }, { status: 400 })
      fields[m.gradeField] = entry.grade
    }
    if (entry.notes !== undefined) {
      if (typeof entry.notes !== 'string') return NextResponse.json({ error: `Invalid notes for ${m.label}` }, { status: 400 })
      fields[m.notesField] = entry.notes || null
    }
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No MEDDICC changes sent' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, fields)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
