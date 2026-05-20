import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/session'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyJWT(cookieStore.get('session')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const body = await req.json()
  const { csv, step, event_name } = body
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  async function claude(prompt: string, maxTokens = 8000): Promise<string> {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const d = await r.json()
    if (d.type === 'error') throw new Error(`Anthropic API: ${d.error?.message || JSON.stringify(d.error)}`)
    if (d.stop_reason === 'max_tokens') throw new Error(`Response truncated — max_tokens (${maxTokens}) hit. Reduce chunk size.`)
    return d.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text || ''
  }

  function parseJSON(text: string): unknown {
    if (!text) return null
    const cleaned = text.replace(/```json\s*\n?|```\s*\n?/g, '').trim()
    try { return JSON.parse(cleaned) } catch {}
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) } catch {}
    }
    // Try array
    const aStart = cleaned.indexOf('[')
    const aEnd = cleaned.lastIndexOf(']')
    if (aStart !== -1 && aEnd > aStart) {
      try { return JSON.parse(cleaned.slice(aStart, aEnd + 1)) } catch {}
    }
    return null
  }

  const PARSE_PROMPT = (csvChunk: string, evName: string) => `You are processing a raw event lead CSV for Orah, a school management software company.

1. PARSE — Detect column meanings from any header naming:
   - Name priority: (a) separate First Name + Last Name columns, (b) Full Name / Name column split on last space, (c) Person Name column — split on last space, strip suffixes like ", MBA", ", TLIS", ", CISM", strip event suffix like "@ ATLIS Annual Conference". Handle prefixes Dr., Mr., Mrs., Prof.
   - If NO name data exists anywhere, set flag_type "missing_data"
   - Company: School, School / Institution Name, Institution, Company, Account
   - Status: Status, Stage, Campaign Status
   - Notes: Notes, Comments, Context, Interaction, Detail
   - Email: any column with "email" or "mail"
   - Job Title: Job Title, Title, Role, Position
   - Assigned To Email: Assigned To Email, Assign To Email, Assign to email
   - Website: School Website, Website, URL — extract domain only
   - Ignore: Timestamp, Column N headers

2. NORMALISE STATUS — map to exactly one of:
   "Demo Interest (MQL)" | "Expansion Interest (CMQL)" | "CSM FUp Required" | "Engaged Outside Booth" | "Visited Booth" | "RSVP"
   Highest rank wins when merging: MQL=5, CMQL=4, CSM=3, Engaged=2, Visited=1, RSVP=0

3. FUZZY DEDUP — compare by individual name ONLY, never by company or title:
   - Same first + last name, same company → MERGE automatically (combine all_notes, keep highest status, fill empty fields from the other row)
   - Same first + last name, different company → FLAG for review (possible job change or name collision)
   - Similar but not identical names that could plausibly be the same person → FLAG (e.g. "Jon" vs "John", nick name, middle initial present)
   - Multiple different people from the same company → NOT a duplicate — do NOT flag or merge, this is normal
   - Never flag solely because two rows share the same company, school, or organisation
   - When uncertain whether two rows are the same individual, FLAG rather than merge
   - For duplicate flags, populate the keys array with the _key values of the involved leads

4. NOTES — collect ALL raw notes into all_notes array (do not summarise)

5. ASSIGNED TO EMAIL — extract as-is, empty string if missing

6. SF CAMPAIGN ID — extract from SF Campaign ID, Salesforce Campaign ID, Campaign ID, or bracketed ID in campaign name. If missing from every row set sf_campaign_id_missing: true.

7. Generate _key: lowercase firstname_lastname_companyslug

8. EVENT NAME CLEAN — if an event_name is provided below, return a clean short display name by stripping internal naming conventions: remove prefixes like "EV-", "EV ", date suffixes like "-2025", "/2025", " 2025", leading/trailing dashes or underscores, and any other non-human-friendly conventions. Return just the readable event name (e.g. "EV-ATLIS Annual Conference-2025" → "ATLIS Annual Conference"). If no event_name is provided, return empty string.

Return ONLY valid JSON, no markdown:
{
  "event_name_clean": "string",
  "sf_campaign_id_missing": false,
  "leads": [{
    "_key": "string",
    "first_name": "string",
    "last_name": "string",
    "job_title": "string",
    "email": "string",
    "company": "string",
    "campaign_status": "string",
    "sf_campaign_id": "string",
    "assigned_to_email": "string",
    "all_notes": ["string"],
    "school_domain": "string",
    "email_confidence": "string"
  }],
  "flagged": [{"reason":"string","flag_type":"duplicate|missing_data|data_quality","rows":["string"],"keys":["string"],"recommendation":"string"}],
  "audit": [{"type":"merge|flag|normalise|field_map|warning","detail":"string"}]
}

${evName ? `Event name (raw): ${evName}\n` : ''}CSV:
${csvChunk}`

  try {
    if (step === 'parse') {
      const text = await claude(PARSE_PROMPT(csv, event_name), 16000)
      const parsed = parseJSON(text)
      if (!parsed) return NextResponse.json({ error: 'Parse agent returned malformed JSON', raw: text.slice(0, 1000) }, { status: 500 })
      return NextResponse.json(parsed)
    }

    if (step === 'dedup') {
      const { leads } = body
      if (!leads?.length) return NextResponse.json([])

      const text = await claude(`Identify duplicates in this list of event leads.

For each group of potential duplicates return the action:
- Same first + last name, same company → "merge"
- Same first + last name, different company → "flag"
- Similar names that could be the same person (nick names, typos, middle initial) → "flag"
- Different people at the same company → NOT a duplicate, do not include

Return ONLY a valid JSON array. If no duplicates return [].
[{"action":"merge"|"flag","keys":["_key1","_key2"],"reason":"string"}]

Leads:
${leads.map((l: { _key: string; first_name: string; last_name: string; company: string }) => `${l._key} | ${l.first_name} ${l.last_name} | ${l.company}`).join('\n')}`, 2000)

      const result = parseJSON(text)
      return NextResponse.json(Array.isArray(result) ? result : [])
    }

    if (step === 'summarise') {
      const { contacts } = body
      if (!contacts?.length) return NextResponse.json([])

      const text = await claude(`Clean up the raw interaction notes from a school software trade show.
For each contact return a lightly edited version of their notes — fix spelling and grammar only, keep all specific details, names, and phrasing as close to the original as possible. Do NOT summarise, condense, or rewrite. Preserve everything mentioned.
Return ONLY a JSON array: [{ "key": "<_key>", "summary": "string" }]

Contacts:
${contacts.map((c: { _key: string; first_name: string; last_name: string; company: string; all_notes: string[] }) => `Key: ${c._key}\nName: ${c.first_name} ${c.last_name} (${c.company})\nNotes: ${c.all_notes.filter(Boolean).join(' | ') || '(none)'}`).join('\n\n')}`, 8000)

      const result = parseJSON(text)
      return NextResponse.json(result || [])
    }

    if (step === 'email') {
      const { contacts } = body
      if (!contacts?.length) return NextResponse.json([])

      const text = await claude(`You are an email research assistant for a B2B SaaS company selling to K-12 and boarding schools.
For each contact find or infer their work email:
1. If you know the school domain, construct the email
2. Use common patterns: firstname.lastname@, f.lastname@
3. Region patterns: UK → .sch.uk/.ac.uk, AU/NZ → .edu.au/.school.nz, US → .edu/.org
Mark confidence: "researched" (confident in domain) or "guessed" (inferred pattern).
Return ONLY a JSON array: [{ "key": "<_key>", "email": "string or null", "confidence": "researched|guessed" }]

Contacts:
${contacts.map((c: { _key: string; first_name: string; last_name: string; job_title: string; company: string; school_domain: string }) => `Key: ${c._key} | ${c.first_name} ${c.last_name} | ${c.job_title || 'unknown'} | ${c.company} | ${c.school_domain || 'unknown'}`).join('\n')}`, 1000)

      const result = parseJSON(text)
      return NextResponse.json(result || [])
    }

    return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
