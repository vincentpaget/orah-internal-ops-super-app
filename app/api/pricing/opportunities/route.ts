import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Connection } from 'jsforce'
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce'
import { getConn } from '@/lib/salesforce'
import { verifyJWT } from '@/lib/session'

export interface ProposalOpp {
  id: string
  name: string
  stage: string
  closeDate: string
  ownerName: string
  ownerEmail: string
  accountName: string
  sis: string | null
  numberInSchool: number | null
  contact: { name: string; title: string | null; email: string | null } | null
}

interface OppRecord {
  Id: string
  Name: string
  StageName: string
  CloseDate: string
  Owner: { Name: string; Email: string | null } | null
  Account: { Name: string; Student_Information_System_SIS_SMS_MIS__c: string | null; Number_in_School__c: number | null } | null
  OpportunityContactRoles: { records: { Contact: { Name: string; Title: string | null; Email: string | null } | null }[] } | null
}

const SOQL = `
  SELECT Id, Name, StageName, CloseDate, Owner.Name, Owner.Email,
         Account.Name, Account.Student_Information_System_SIS_SMS_MIS__c, Account.Number_in_School__c,
         (SELECT Contact.Name, Contact.Title, Contact.Email FROM OpportunityContactRoles WHERE IsPrimary = true LIMIT 1)
  FROM Opportunity
  WHERE IsClosed = false AND StageName IN ('Evaluation','Proposal')
  ORDER BY Account.Name
  LIMIT 500
`

// Read-only: open Evaluation/Proposal opportunities for the offer builder's picker.
// Prefers the rep's own Salesforce session (sf_session, 8h); falls back to the server-side
// integration user once that has expired, as the app session lasts longer (24h).
export async function GET() {
  const session = verifyJWT((await cookies()).get('session')?.value ?? '')
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    let records: OppRecord[]
    const userConn = await getConnectionFromCookie()
    try {
      if (!userConn) throw new Error('No Salesforce session')
      records = (await userConn.query<OppRecord>(SOQL)).records
    } catch (userErr) {
      if (userConn) console.warn('[pricing/opportunities] user session failed, using integration user:', userErr)
      const conn: Connection = await getConn()
      records = (await conn.query<OppRecord>(SOQL)).records
    }

    const opps: ProposalOpp[] = records.map(r => {
      const contact = r.OpportunityContactRoles?.records?.[0]?.Contact ?? null
      return {
        id: r.Id,
        name: r.Name,
        stage: r.StageName,
        closeDate: r.CloseDate,
        ownerName: r.Owner?.Name ?? '',
        ownerEmail: r.Owner?.Email ?? '',
        accountName: r.Account?.Name ?? '',
        sis: r.Account?.Student_Information_System_SIS_SMS_MIS__c ?? null,
        numberInSchool: r.Account?.Number_in_School__c ?? null,
        contact: contact ? { name: contact.Name, title: contact.Title, email: contact.Email } : null,
      }
    })

    return NextResponse.json({ opportunities: opps })
  } catch (err) {
    console.error('[pricing/opportunities]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Salesforce query failed' }, { status: 500 })
  }
}
