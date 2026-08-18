import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { opportunityId, reengage, nurtureReason, nextStep, managerReviewNotes } = body as {
    opportunityId?: string
    reengage?: string | null
    nurtureReason?: string | null
    nextStep?: string | null
    managerReviewNotes?: string | null
  }

  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, {
      Re_engagement_Date__c: reengage || null,
      Nurturing_Reason__c: nurtureReason || null,
      NextStep: nextStep || null,
      Manager_Review_Notes__c: managerReviewNotes || null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
