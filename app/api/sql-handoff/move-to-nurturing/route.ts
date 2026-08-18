import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { buildMeddiccFields, isPastDate } from '@/lib/sql-handoff/logic'
import type { MeddiccKey } from '@/lib/sql-handoff/types'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { opportunityId, closeDate, amount, nextStep, reengage, nurtureReason, meddicc } = body as {
    opportunityId?: string
    closeDate?: string
    amount?: number
    nextStep?: string | null
    reengage?: string
    nurtureReason?: string
    meddicc?: Partial<Record<MeddiccKey, { grade: string; notes: string }>>
  }

  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }
  if (!closeDate || isPastDate(closeDate) || !reengage || (reengage && closeDate < reengage) || !nurtureReason || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Close Date, Amount (>0), Re-engagement Date, and Nurturing Reason are required to move to Nurture' }, { status: 400 })
  }
  const eb = meddicc?.eb?.grade
  const ce = meddicc?.ce?.grade
  if (eb === 'Red' || ce === 'Red' || !eb || !ce) {
    return NextResponse.json({ error: 'Economic Buyer and Compelling Event must be at least Yellow to move to Nurture' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, {
      StageName: 'Nurturing',
      CloseDate: closeDate,
      Amount: amount,
      NextStep: nextStep || null,
      Re_engagement_Date__c: reengage,
      Nurturing_Reason__c: nurtureReason,
      ...buildMeddiccFields(meddicc ?? {}),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
