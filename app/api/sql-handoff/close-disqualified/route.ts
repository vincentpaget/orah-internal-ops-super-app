import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { LOSS_REASONS } from '@/lib/sql-handoff/types'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { opportunityId, lossReasonLabel, lossDetail, nextStep } = body as {
    opportunityId?: string
    lossReasonLabel?: string
    lossDetail?: string
    nextStep?: string
  }

  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }
  const reason = LOSS_REASONS.find(r => r.label === lossReasonLabel)
  if (!reason || !lossDetail || !nextStep) {
    return NextResponse.json({ error: 'Loss Reason, Loss Reason Detail, and Next Steps are required to close as Disqualified' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, {
      StageName: 'Closed - Disqualified',
      Loss_Reason__c: reason.value,
      Loss_Reason_Detail__c: lossDetail,
      NextStep: nextStep,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
