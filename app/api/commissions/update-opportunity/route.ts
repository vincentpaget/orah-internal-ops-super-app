import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { getCommissionsPermissions } from '@/lib/commissions/permissions'
import { updateCommissionFields } from '@/lib/commissions/salesforce'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!getCommissionsPermissions(session).isAdmin) {
    return NextResponse.json({ error: 'Read-only access — you do not have permission to edit commissions' }, { status: 403 })
  }

  const body = await req.json()
  const { id, commissionAmountNZD, commissionNotes, commissionPaid, commissionPaidAmountNZD, commissionPaidDate } = body as {
    id?: string
    commissionAmountNZD?: number | null
    commissionNotes?: string | null
    commissionPaid?: boolean | null
    commissionPaidAmountNZD?: number | null
    commissionPaidDate?: string | null
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    await updateCommissionFields(id, {
      Commission_Amount_NZD__c: commissionAmountNZD ?? null,
      Commission_Notes__c: commissionNotes ?? null,
      Commission_Paid__c: commissionPaid ?? null,
      Commission_Paid_Amount_NZD__c: commissionPaidAmountNZD ?? null,
      Commission_Paid_Date__c: commissionPaidDate ?? null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
