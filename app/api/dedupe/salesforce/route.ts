import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

const SF_LOGIN_URL = 'https://login.salesforce.com/services/Soap/u/56.0'

interface SFSession { sessionId: string; serverUrl: string; instanceUrl: string }

async function sfLogin(): Promise<SFSession> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body><urn:login>
    <urn:username>${process.env.SF_USERNAME}</urn:username>
    <urn:password>${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN}</urn:password>
  </urn:login></soapenv:Body>
</soapenv:Envelope>`
  const res = await fetch(SF_LOGIN_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml', SOAPAction: 'login' }, body: xml })
  const text = await res.text()
  if (text.includes('<faultcode>')) throw new Error(text.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1] ?? 'SF login failed')
  const sessionId = text.match(/<sessionId>(.*?)<\/sessionId>/)?.[1] ?? ''
  const serverUrl = text.match(/<serverUrl>(.*?)<\/serverUrl>/)?.[1] ?? ''
  const instanceUrl = serverUrl.replace(/\/services\/Soap.*$/, '')
  return { sessionId, serverUrl, instanceUrl }
}

async function soapCall(session: SFSession, body: string): Promise<string> {
  const res = await fetch(session.serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', SOAPAction: '""' },
    body,
  })
  return res.text()
}

function mergeXml(session: SFSession, masterSfId: string, victimSfId: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Header><urn:SessionHeader><urn:sessionId>${session.sessionId}</urn:sessionId></urn:SessionHeader></soapenv:Header>
  <soapenv:Body><urn:merge>
    <urn:request>
      <urn:masterRecord xsi:type="urn:Account" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <urn:Id>${masterSfId}</urn:Id>
      </urn:masterRecord>
      <urn:recordToMergeIds>${victimSfId}</urn:recordToMergeIds>
    </urn:request>
  </urn:merge></soapenv:Body>
</soapenv:Envelope>`
}

// Extract a single field value from a SOAP record block.
// Handles both <Field>value</Field> and <ns:Field attr="...">value</ns:Field>.
function getField(block: string, field: string): string {
  const m = block.match(new RegExp(`<(?:\\w+:)?${field}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${field}>`))
  return m?.[1]?.trim() ?? ''
}

// Extract all <records>…</records> inner content blocks from a SOAP query response.
function getRecordBlocks(xml: string): string[] {
  const blocks: string[] = []
  const re = /<records[^>]*>([\s\S]*?)<\/records>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) blocks.push(m[1])
  return blocks
}

// Finds ACRs shared between master and victim, deletes whichever side is indirect,
// then retries the merge. No PATCH needed — the merge re-parents contacts automatically.
async function fixSharedContactsAndRetry(
  session: SFSession, masterSfId: string, victimSfId: string
): Promise<{ fixed: number }> {
  // Query ACRs for BOTH accounts in one call so we can detect shared contacts
  const queryXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Header><urn:SessionHeader><urn:sessionId>${session.sessionId}</urn:sessionId></urn:SessionHeader></soapenv:Header>
  <soapenv:Body><urn:query>
    <urn:queryString>SELECT Id, AccountId, ContactId, IsDirect FROM AccountContactRelation WHERE AccountId IN ('${masterSfId}', '${victimSfId}')</urn:queryString>
  </urn:query></soapenv:Body>
</soapenv:Envelope>`

  const queryRes = await soapCall(session, queryXml)
  const blocks = getRecordBlocks(queryRes)

  // Build per-account maps: contactId → { acrId, isDirect }
  const masterAcrs = new Map<string, { id: string; isDirect: boolean }>()
  const victimAcrs  = new Map<string, { id: string; isDirect: boolean }>()

  for (const block of blocks) {
    const id        = getField(block, 'Id')
    const accountId = getField(block, 'AccountId')
    const contactId = getField(block, 'ContactId')
    const isDirect  = getField(block, 'IsDirect').toLowerCase() === 'true'
    if (!id || !contactId) continue
    if (accountId === masterSfId) masterAcrs.set(contactId, { id, isDirect })
    else if (accountId === victimSfId) victimAcrs.set(contactId, { id, isDirect })
  }

  // For each contact that appears on BOTH accounts, delete the indirect ACR.
  // The merge will then re-parent the direct (primary) relationship automatically.
  const toDelete: string[] = []
  let fixed = 0

  for (const [contactId, victimAcr] of victimAcrs) {
    const masterAcr = masterAcrs.get(contactId)
    if (!masterAcr) continue // not shared — merge handles re-parenting, nothing to do

    if (!victimAcr.isDirect) {
      // Victim has indirect ACR → delete it; master already owns this contact
      toDelete.push(victimAcr.id)
    } else if (!masterAcr.isDirect) {
      // Victim has direct (primary), master has indirect → delete master's indirect
      // The merge will move the direct relationship from victim to master
      toDelete.push(masterAcr.id)
    }
    // Both direct is theoretically impossible (a contact has one primary account)
    fixed++
  }

  if (toDelete.length > 0) {
    const deleteXml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Header><urn:SessionHeader><urn:sessionId>${session.sessionId}</urn:sessionId></urn:SessionHeader></soapenv:Header>
  <soapenv:Body><urn:delete>
    ${toDelete.map(id => `<urn:ids>${id}</urn:ids>`).join('\n    ')}
  </urn:delete></soapenv:Body>
</soapenv:Envelope>`
    const deleteRes = await soapCall(session, deleteXml)
    if (deleteRes.includes('<success>false</success>')) {
      const msg = deleteRes.match(/<message>([\s\S]*?)<\/message>/)?.[1] ?? 'ACR deletion failed'
      throw new Error(`ACR fix failed: ${msg}`)
    }
  }

  // Retry merge
  const retryRes = await soapCall(session, mergeXml(session, masterSfId, victimSfId))
  if (!retryRes.includes('<success>true</success>')) {
    const msg = retryRes.match(/<message>([\s\S]*?)<\/message>/)?.[1] ?? 'Merge failed after ACR fix'
    throw new Error(msg)
  }

  return { fixed }
}

async function mergePair(
  session: SFSession,
  masterSfId: string,
  victimSfId: string
): Promise<{ autoFixed?: { victimSfId: string; fixed: number } }> {
  const xml = mergeXml(session, masterSfId, victimSfId)
  const res = await soapCall(session, xml)

  if (res.includes('<success>true</success>')) return {}

  const errMsg = res.match(/<message>([\s\S]*?)<\/message>/)?.[1] ?? 'Merge failed'

  if (errMsg.toLowerCase().includes('entity is deleted')) {
    // Victim SF account was already merged in a previous attempt — treat as success
    return {}
  }

  if (errMsg.includes('AccountContactRelation') || errMsg.includes('DUPLICATE_VALUE') || errMsg.includes('same related')) {
    const { fixed } = await fixSharedContactsAndRetry(session, masterSfId, victimSfId)
    return { autoFixed: { victimSfId, fixed } }
  }

  throw new Error(errMsg)
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  if (body.action !== 'merge') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const batch: { masterSfId: string; victimSfId: string; victimHsId?: string }[] = body.batch

  try {
    const session = await sfLogin()
    let merged = 0
    const autoFixed: { victimSfId: string; fixed: number }[] = []
    const errors: { victimSfId: string; message: string }[] = []

    for (const { masterSfId, victimSfId } of batch) {
      try {
        const result = await mergePair(session, masterSfId, victimSfId)
        if (result.autoFixed) autoFixed.push(result.autoFixed)
        merged++
      } catch (err) {
        errors.push({ victimSfId, message: err instanceof Error ? err.message : String(err) })
      }
    }

    return NextResponse.json({ merged, autoFixed, errors })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
