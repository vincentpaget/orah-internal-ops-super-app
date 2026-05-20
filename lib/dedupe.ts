export interface RecordObj {
  id: string
  name: string
  domain: string
  sfId: string
  contacts: number
  deals: number
  state: string
  country: string
  website: string
  ownerId: string
  createdDate: string
  lastSalesActivity: string
  aiResearchLastCompleted: string
  toBeDeleted: boolean
}

export interface ClusterObj {
  clusterId: string
  masterId: string
  victimIds: string[]
  records: Record<string, RecordObj>
  flagType: 'conflict' | 'nosf' | null
  resolved: boolean
}

export interface DedupeStats {
  clusters: number
  victims: number
  contacts: number
  sfRows: number
  conflicts: number
  nosf: number
  ignored: number
}

function formatActivityDate(raw: string): string {
  if (!raw || raw === '0' || !raw.trim()) return ''
  const ts = parseInt(raw, 10)
  if (!isNaN(ts) && ts > 0) {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return raw
}

// Single-pass CSV parser — exact port of the original app's implementation.
// Returns headers separately so the caller can validate required columns before processing.
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: Record<string, string>[] = []
  let headers: string[] | null = null
  let fields: string[] = []
  let field = ''
  let inQ = false

  const flush = () => { fields.push(field); field = '' }
  const flushRow = () => {
    if (headers === null) {
      headers = fields.map(h => h.trim().toUpperCase())
    } else if (fields.length > 1 || fields[0] !== '') {
      const obj: Record<string, string> = {}
      for (let i = 0; i < (headers as string[]).length; i++) {
        obj[(headers as string[])[i]] = fields[i] !== undefined ? fields[i] : ''
      }
      rows.push(obj)
    }
    fields = []
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQ = false
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQ = true
      } else if (c === ',') {
        flush()
      } else if (c === '\r' && text[i + 1] === '\n') {
        flush(); flushRow(); i++
      } else if (c === '\n') {
        flush(); flushRow()
      } else {
        field += c
      }
    }
  }
  if (field || fields.length) { flush(); if (headers) flushRow() }

  return { headers: headers ?? [], rows }
}

function makeUF() {
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()

  function find(x: string): string {
    if (!parent.has(x)) { parent.set(x, x); rank.set(x, 0) }
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    const rankA = rank.get(ra) ?? 0
    const rankB = rank.get(rb) ?? 0
    if (rankA < rankB) parent.set(ra, rb)
    else if (rankA > rankB) parent.set(rb, ra)
    else { parent.set(rb, ra); rank.set(ra, rankA + 1) }
  }

  return { find, union }
}

function selectMaster(records: RecordObj[]): { master: RecordObj; victims: RecordObj[]; flagType: 'conflict' | 'nosf' | null } {
  const hasSf = records.filter(r => r.sfId)

  if (hasSf.length === 0) {
    const sorted = [...records].sort((a, b) => {
      const dc = b.contacts - a.contacts
      if (dc !== 0) return dc
      return Number(a.id) - Number(b.id)
    })
    const master = sorted[0]
    return { master, victims: records.filter(r => r.id !== master.id), flagType: 'nosf' }
  }

  if (hasSf.length === 1) {
    return { master: hasSf[0], victims: records.filter(r => r.id !== hasSf[0].id), flagType: null }
  }

  // Multiple SF records
  const withDeals = hasSf.filter(r => (r.deals || 0) > 0)

  let flagType: 'conflict' | 'nosf' | null = null
  let candidates = hasSf

  if (withDeals.length === 1) {
    return { master: withDeals[0], victims: records.filter(r => r.id !== withDeals[0].id), flagType: null }
  }

  if (withDeals.length > 1) {
    flagType = 'conflict'
    candidates = withDeals
  }

  const sorted = [...candidates].sort((a, b) => {
    const dc = b.contacts - a.contacts
    if (dc !== 0) return dc
    return Number(a.id) - Number(b.id)
  })
  const master = sorted[0]
  return { master, victims: records.filter(r => r.id !== master.id), flagType }
}

export function buildClusters(rows: Record<string, string>[]): { clusters: ClusterObj[]; totalRecords: number } {
  const recMap = new Map<string, RecordObj>()

  for (const row of rows) {
    for (const suffix of ['1', '2'] as const) {
      const id = (row[`ID_${suffix}`] || '').trim()
      if (!id || recMap.has(id)) continue
      const cdRaw = parseInt(row[`CREATEDATE_${suffix}`] || '0', 10)
      recMap.set(id, {
        id,
        name:                  (row[`NAME_${suffix}`]                           || '').trim(),
        domain:                (row[`DOMAIN_${suffix}`]                          || '').trim(),
        sfId:                  (row[`SALESFORCEACCOUNTID_${suffix}`]             || '').trim(),
        contacts:              parseInt(row[`NUM_ASSOCIATED_CONTACTS_${suffix}`] || '0', 10) || 0,
        deals:                 parseInt(row[`NUM_ASSOCIATED_DEALS_${suffix}`]    || '0', 10) || 0,
        state:                 (row[`STATE_${suffix}`]                           || '').trim(),
        country:               (row[`COUNTRY_${suffix}`]                         || '').trim(),
        website:               (row[`WEBSITE_${suffix}`]                         || '').trim(),
        ownerId:               (row[`HUBSPOT_OWNER_ID_${suffix}`]                || '').trim(),
        createdDate:           cdRaw ? new Date(cdRaw).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '',
        lastSalesActivity:     formatActivityDate(row[`HS_LAST_SALES_ACTIVITY_TIMESTAMP_${suffix}`]  || ''),
        aiResearchLastCompleted: formatActivityDate(row[`AI_RESEARCH_LAST_COMPLETED_${suffix}`]      || ''),
        toBeDeleted:           (row[`TO_BE_DELETED_${suffix}`] || '').trim().toLowerCase() === 'true',
      })
    }
  }

  const uf = makeUF()
  for (const row of rows) {
    const id1 = (row['ID_1'] || '').trim()
    const id2 = (row['ID_2'] || '').trim()
    if (id1 && id2) uf.union(id1, id2)
  }

  const rootMap = new Map<string, Set<string>>()
  for (const id of recMap.keys()) {
    const root = uf.find(id)
    if (!rootMap.has(root)) rootMap.set(root, new Set())
    rootMap.get(root)!.add(id)
  }

  const clusters: ClusterObj[] = []
  for (const [root, idSet] of rootMap) {
    const records = [...idSet].map(id => recMap.get(id)!)
    const { master, victims, flagType } = selectMaster(records)
    clusters.push({
      clusterId: root,
      masterId: master.id,
      victimIds: victims.map(r => r.id),
      records: Object.fromEntries(records.map(r => [r.id, r])),
      flagType,
      resolved: flagType !== 'conflict',
    })
  }

  clusters.sort((a, b) => {
    const order: Record<string, number> = { conflict: 0, nosf: 1 }
    return (order[a.flagType ?? ''] ?? 2) - (order[b.flagType ?? ''] ?? 2)
  })

  return { clusters, totalRecords: recMap.size }
}

export function computeStats(clusters: ClusterObj[], ignored: Set<string>): DedupeStats {
  let victims = 0, contacts = 0, sfRows = 0, conflicts = 0, nosf = 0
  for (const c of clusters) {
    if (ignored.has(c.clusterId)) continue
    victims += c.victimIds.length
    for (const vid of c.victimIds) {
      const r = c.records[vid]
      contacts += r?.contacts || 0
      if (r?.sfId) sfRows++
    }
    if (c.flagType === 'conflict') conflicts++
    if (c.flagType === 'nosf') nosf++
  }
  return { clusters: clusters.length, victims, contacts, sfRows, conflicts, nosf, ignored: ignored.size }
}

export function getMasterId(cluster: ClusterObj, overrides: Record<string, string>): string {
  return overrides[cluster.clusterId] ?? cluster.masterId
}

export function getVictimIds(cluster: ClusterObj, overrides: Record<string, string>): string[] {
  const mid = getMasterId(cluster, overrides)
  return Object.keys(cluster.records).filter(id => id !== mid)
}
