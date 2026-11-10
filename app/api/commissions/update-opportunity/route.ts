import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'
import { getCommissionsPermissions } from '@/lib/commissions/permissions'
import { updateCommissionFields } from '@/lib/commissions/salesforce'

const FIELD_MAP = {
  commissionAmount: 'Commission_Amount_NZD__c',
  commissionNotes: 'Commission_Notes__c',
  commissionPaid: 'Commission_Paid__c',
  commissionPaidAmount: 'Commission_Paid_Amount_NZD__c',
  commissionPaidDate: 'Commission_Paid_Date__c',
  onboardingCommissionPaidAmount: 'Onboarding_Commission_Paid_Amount_NZD__c',
  onboardingCommissionPaidDate: 'Onboarding_Commission_Paid_Date__c',
} as const

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifyJWT(cookieStore.get('session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!getCommissionsPermissions(session).isAdmin) {
    return NextResponse.json({ error: 'Read-only access — you do not have permission to edit commissions' }, { status: 403 })
  }

  const body = await req.json() as { id?: string; fields?: Record<string, unknown> }
  const { id, fields } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Only the keys the client sent are written, so syncing the onboarding row never touches ARR commission fields
  // (and vice versa). Unknown keys are ignored.
  const sfFields: Parameters<typeof updateCommissionFields>[1] = {}
  for (const [key, sfName] of Object.entries(FIELD_MAP)) {
    if (key in fields) (sfFields as Record<string, unknown>)[sfName] = fields[key] ?? null
  }
  if (Object.keys(sfFields).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    await updateCommissionFields(id, sfFields)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
