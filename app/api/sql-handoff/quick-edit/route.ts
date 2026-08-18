import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { buildMeddiccFields } from '@/lib/sql-handoff/logic'
import type { MeddiccKey } from '@/lib/sql-handoff/types'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { opportunityId, closeDate, amount, nextStep, outcome, managerReviewNotes, fup, discoveryNotes, meddicc } = body as {
    opportunityId?: string
    closeDate?: string | null
    amount?: number | null
    nextStep?: string | null
    outcome?: string | null
    managerReviewNotes?: string | null
    fup?: string | null
    discoveryNotes?: string | null
    meddicc?: Partial<Record<MeddiccKey, { grade: string; notes: string }>>
  }

  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, {
      CloseDate: closeDate || null,
      Amount: amount ?? null,
      NextStep: nextStep || null,
      Initial_Meeting_Outcome__c: outcome || null,
      Manager_Review_Notes__c: managerReviewNotes || null,
      Initial_Meeting_FUp_Email_Status__c: fup || null,
      Discovery_Notes__c: discoveryNotes || null,
      ...buildMeddiccFields(meddicc ?? {}),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
