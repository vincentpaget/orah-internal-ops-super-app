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
  const { opportunityId, closeDate, amount, nextStep, meddicc } = body as {
    opportunityId?: string
    closeDate?: string
    amount?: number
    nextStep?: string | null
    meddicc?: Partial<Record<MeddiccKey, { grade: string; notes: string }>>
  }

  if (!opportunityId) {
    return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 })
  }
  if (!closeDate || isPastDate(closeDate) || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Close Date (not in the past) and Amount (>0) are required to move to Evaluation' }, { status: 400 })
  }
  const eb = meddicc?.eb?.grade
  const ce = meddicc?.ce?.grade
  if (eb === 'Red' || ce === 'Red' || !eb || !ce) {
    return NextResponse.json({ error: 'Economic Buyer and Compelling Event must be at least Yellow to move to Evaluation' }, { status: 400 })
  }

  try {
    const { updateOpportunityFields } = await import('@/lib/sql-handoff/salesforce')
    await updateOpportunityFields(opportunityId, {
      StageName: 'Evaluation',
      CloseDate: closeDate,
      Amount: amount,
      NextStep: nextStep || null,
      ...buildMeddiccFields(meddicc ?? {}),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
