import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

const HS_BASE = 'https://api.hubapi.com'
const TOKEN = () => process.env.HUBSPOT_ACCESS_TOKEN || ''

async function hsFetch(path: string, opts: RequestInit = {}, retries = 3): Promise<Response> {
  const url = `${HS_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN()}`,
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  }
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { ...opts, headers })
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') ?? '5') * 1000
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return res
  }
  throw new Error(`HubSpot API failed after ${retries} retries: ${path}`)
}

async function getAssociatedContacts(companyId: string): Promise<string[]> {
  const res = await hsFetch(`/crm/v4/objects/companies/${companyId}/associations/contacts?limit=500`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((r: { toObjectId: string }) => String(r.toObjectId))
}

async function hasAnyContacts(companyId: string): Promise<boolean> {
  const res = await hsFetch(`/crm/v4/objects/companies/${companyId}/associations/contacts?limit=1`)
  if (!res.ok) return false
  const data = await res.json()
  return (data.results ?? []).length > 0
}

// Retries hasAnyContacts with delays to handle HubSpot eventual consistency after a remap.
async function waitForContactsClear(companyId: string): Promise<boolean> {
  const delays = [1500, 3000]
  if (!(await hasAnyContacts(companyId))) return true
  for (const delay of delays) {
    await new Promise(r => setTimeout(r, delay))
    if (!(await hasAnyContacts(companyId))) return true
  }
  return false
}

async function removeVictimContactAssocs(victimId: string, contactIds: string[]): Promise<void> {
  if (!contactIds.length) return
  // batch/archive requires `to` as an array, not an object
  const body = { inputs: [{ from: { id: victimId }, to: contactIds.map(id => ({ id })) }] }
  const res = await hsFetch('/crm/v4/associations/company/contact/batch/archive', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`remove contact associations failed (${res.status}): ${txt.slice(0, 300)}`)
  }
}

async function addAssociations(masterId: string, contactIds: string[]) {
  if (!contactIds.length) return
  const body = {
    inputs: contactIds.map(cid => ({
      from: { id: masterId },
      to: { id: cid },
      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 280 }],
    })),
  }
  await hsFetch('/crm/v4/associations/company/contact/batch/create', { method: 'POST', body: JSON.stringify(body) })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  try {
    // ── remap: move contacts from victims to master ──
    if (action === 'remap') {
      const batch: { masterId: string; victimId: string }[] = body.batch
      const detail: { ok: boolean; contactsFound: number; victimId: string; error?: string }[] = []

      for (const { masterId, victimId } of batch) {
        try {
          const contacts = await getAssociatedContacts(victimId)
          if (contacts.length) {
            await removeVictimContactAssocs(victimId, contacts)
            await addAssociations(masterId, contacts)
            // Verify removal took effect — HubSpot (and SF sync) can recreate associations.
            // Wait briefly then retry removal for any that reappeared.
            await new Promise(r => setTimeout(r, 1500))
            const stillPresent = await getAssociatedContacts(victimId)
            const stillLinked = stillPresent.filter(id => contacts.includes(id))
            if (stillLinked.length > 0) {
              await removeVictimContactAssocs(victimId, stillLinked)
            }
          }
          detail.push({ ok: true, contactsFound: contacts.length, victimId })
        } catch (err) {
          detail.push({ ok: false, contactsFound: 0, victimId, error: err instanceof Error ? err.message : String(err) })
        }
      }
      return NextResponse.json({ detail })
    }

    // ── mark: set to_be_deleted=true on victims with 0 live contacts ──
    if (action === 'mark') {
      const victimIds: string[] = body.victimIds
      const toMark: string[] = []
      const skipped: string[] = []
      const errors: { id: string; message: string }[] = []

      for (const id of victimIds) {
        try {
          const clear = await waitForContactsClear(id)
          if (!clear) { skipped.push(id) } else { toMark.push(id) }
        } catch (err) {
          errors.push({ id, message: err instanceof Error ? err.message : String(err) })
        }
      }

      if (toMark.length) {
        const batchBody = { inputs: toMark.map(id => ({ id, properties: { to_be_deleted: 'true' } })) }
        const res = await hsFetch('/crm/v3/objects/companies/batch/update', { method: 'POST', body: JSON.stringify(batchBody) })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`batch-update failed ${res.status}: ${txt.slice(0, 200)}`)
        }
      }

      return NextResponse.json({ marked: toMark.length, skipped, errors })
    }

    // ── getOwners: return { ownerId: displayName } map ──
    if (action === 'getOwners') {
      const ownerMap: Record<string, string> = {}
      let after: string | undefined
      do {
        const url = `/crm/v3/owners?limit=100${after ? `&after=${after}` : ''}`
        const res = await hsFetch(url)
        if (!res.ok) throw new Error(`getOwners failed: ${res.status}`)
        const data = await res.json()
        for (const o of (data.results ?? [])) {
          const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || String(o.id)
          ownerMap[String(o.id)] = name
        }
        after = data.paging?.next?.after
      } while (after)
      return NextResponse.json({ owners: ownerMap })
    }

    // ── updateCompany: PATCH a single company ──
    if (action === 'updateCompany') {
      const { companyId, properties } = body
      const res = await hsFetch(`/crm/v3/objects/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      })
      if (!res.ok) throw new Error(`updateCompany failed: ${res.status}`)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
