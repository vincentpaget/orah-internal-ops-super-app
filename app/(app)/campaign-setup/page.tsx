'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
type Stage = 'form' | 'confirming' | 'confirmed' | 'triggering' | 'done' | 'error'
type CampaignType = 'dm' | 'wb' | 'ev'
type FormData = Record<string, string>

interface ConfirmedData {
  _type: CampaignType
  campaignType: string
  campaignName: string
  summary: Record<string, string>
  warnings: string[]
  descriptionWasDrafted: boolean
  descriptionWasPolished: boolean
}

interface Asset { type: string; name: string; id: string }

// ── System prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Campaign Setup Agent for the Orah marketing team. Your job is to help marketing managers set up campaigns by processing submitted form data, confirming it, and triggering the correct N8N workflow.

## Available Campaign Types & N8N Workflows
- Direct Mail → workflow named: "Campaign Setup - Direct Mail"
- Webinar → workflow named: "Campaign Setup - Webinar"
- Event / Trade Show → workflow named: "Campaign Setup - Event (Tradeshow)"

## Naming Conventions
- DM: "DM - YY.MM.DD - Short Campaign Name" (use start date)
- Webinar: "WB - YY.MM.DD - Webinar Name" (use webinar date)
- Event: "EV - YY.MM.DD - Event Name" (use event start date)

## Asset Link Formats
- HubSpot Workflow: https://app.hubspot.com/workflows/20549138/platform/flow/[WORKFLOW_ID]/
- HubSpot List: https://app.hubspot.com/contacts/20549138/objectLists/[LIST_ID]/filters
- Salesforce Campaign: https://orah.lightning.force.com/lightning/r/Campaign/[CAMPAIGN_ID]/view

## Manual Actions

### Direct Mail
Before sending: 1. Add target contacts to the HubSpot list. 2. Manually enrol list members into the DM - Sent workflow.
After sending: 3. Update workflow triggers for DM - Responded and the active workflow.

### Webinar
After the webinar: 1. Upload the recording to the on-demand URL. 2. Deactivate the registration and attended workflows. 3. Activate the on-demand workflow.

### Event / Trade Show
Pre-event: 1. Build target contact lists in HubSpot. 2. Enrol contacts into the pre-event sequence.
During event: 3. Log all interactions into the Notion event database.
Post-event: 4. Clean the interactions log. 5. Import the lead list. 6. Enrol contacts into the post-event follow-up sequence.

## Instructions:

FORMAT A — "CONFIRM_CAMPAIGN: ..."
Parse all values, build the formatted campaign name using naming conventions, normalise all dates to YYYY-MM-DD.

Description handling:
- If the description field is "[please draft a description]": write a single concise sentence (max 120 characters) describing what the campaign is and who it targets. Factual and internal — no slogans or calls to action. Set descriptionWasDrafted: true.
- If the user has provided a description: polish and clean it up for professional internal use (fix grammar, improve clarity, tighten wording) without changing its meaning or adding new information. Set descriptionWasDrafted: false, descriptionWasPolished: true.
- If the description is already clean and needs no changes: leave it as-is. Set descriptionWasDrafted: false, descriptionWasPolished: false.

Return raw JSON only (no prose, no markdown fences, no backticks):
{
  "action": "confirm",
  "campaignType": "...",
  "campaignName": "...",
  "summary": {
    "Campaign description": "...(drafted, polished, or original description — always include this field)",
    ...all other fields as key-value pairs, dates normalised to YYYY-MM-DD...
  },
  "warnings": ["..."] or [],
  "descriptionWasDrafted": true or false,
  "descriptionWasPolished": true or false
}
IMPORTANT: The "summary" object must ALWAYS include "Campaign description" as the first key. Never omit it.

WARNING RULES — only warn about these specific issues:
- A date appears to be in the wrong format or is in the past unexpectedly
- A numeric field looks like a likely typo (e.g. an unusual number where a round number is expected)
- A required field from the submitted form is blank or clearly malformed
Do NOT warn about: missing IDs for assets the workflow will create (e.g. HubSpot list IDs, Salesforce IDs), missing optional fields, or anything not submitted in the form.

ALWAYS respond with raw JSON only — no markdown, no prose, no backticks.`

// ── Constants ─────────────────────────────────────────────────────────────
const CAMPAIGN_TYPES = [
  { id: 'dm' as CampaignType, label: 'Direct mail',        sub: 'DM - YY.MM.DD' },
  { id: 'wb' as CampaignType, label: 'Webinar',            sub: 'WB - YY.MM.DD' },
  { id: 'ev' as CampaignType, label: 'Event / trade show', sub: 'EV - YY.MM.DD' },
]

const ACTIONS: Record<CampaignType, { title: string; items: string[] }[]> = {
  dm: [
    { title: 'Before sending', items: ['Add target contacts to the HubSpot list', 'Manually enroll list members into the DM - Sent workflow'] },
    { title: 'After sending', items: ['Update workflow triggers for DM - Responded and the active workflow'] },
  ],
  wb: [
    { title: 'After the webinar', items: ['Upload the recording to the On-Demand URL', 'Deactivate the Registration and Attended workflows', 'Activate the On-Demand workflow'] },
  ],
  ev: [
    { title: 'Pre-event', items: ['Build target contact lists in HubSpot', 'Manually enroll contacts into the pre-event sequence'] },
    { title: 'During event', items: ['Log all interactions into the Notion Event Interaction Log found on the Notion Campaign Page'] },
    { title: 'Post-event', items: ['Clean the interactions log to prepare the final lead list', 'Use the "Event Lead Import" tool to clean and import the lead list', 'Manually enroll contacts into the post-event follow-up sequence'] },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtName(prefix: string, name: string, date: string): string | null {
  if (!name || !date) return null
  const d = new Date(date + 'T00:00:00')
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${prefix} - ${yy}.${mm}.${dd} - ${name.trim()}`
}

function assetLink(type: string, id: string): string | null {
  if (type === 'HubSpot Workflow') return `https://app.hubspot.com/workflows/20549138/platform/flow/${id}/`
  if (type === 'HubSpot List') return `https://app.hubspot.com/contacts/20549138/objectLists/${id}/filters`
  if (type === 'Salesforce Campaign') return `https://orah.lightning.force.com/lightning/r/Campaign/${id}/view`
  if (type === 'Notion Page') return id
  return null
}

function isReady(type: CampaignType, d: FormData): boolean {
  if (type === 'dm') return !!(d.name && d.start && d.seqid && d.delay && d.conv)
  if (type === 'wb') return !!(d.name && d.date && d.zoomid && d.lpath && d.odurl)
  if (type === 'ev') return !!(d.name && d.start && d.end && d.promo && d.pre && d.post)
  return false
}

function buildMsg(type: CampaignType, d: FormData): string {
  if (type === 'dm') return `CONFIRM_CAMPAIGN: Direct Mail\nCampaign name (short): ${d.name}\nStart date: ${d.start}\nDescription: ${d.desc || '[please draft a description]'}\nFollow-up sequence ID: ${d.seqid}\nSequence start delay (days): ${d.delay}\nConversion window (days): ${d.conv}`
  if (type === 'wb') return `CONFIRM_CAMPAIGN: Webinar\nWebinar name: ${d.name}\nWebinar date: ${d.date}\nDescription: ${d.desc || '[please draft a description]'}\nZoom webinar ID: ${d.zoomid}\nLanding page path: ${d.lpath}\nOn-demand URL: ${d.odurl}\nOn-demand email subject: ${d.odsub || `[use default: Webinar Recording: ${d.name}]`}`
  return `CONFIRM_CAMPAIGN: Event / Trade Show\nEvent name: ${d.name}\nEvent start date: ${d.start}\nEvent end date: ${d.end}\nPromotion start date: ${d.promo}\nDescription: ${d.desc || '[please draft a description]'}\nPre-event sequence IDs: ${d.pre}\nAt-event sequence IDs: ${d.at || '—'}\nPost-event sequence IDs: ${d.post}`
}

async function callAI(userMsg: string): Promise<ConfirmedData> {
  const r = await fetch('/api/campaign-setup/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMsg }] }),
  })
  const data = await r.json()
  const txt = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim()
  const match = txt.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response. Raw: ' + JSON.stringify(data).slice(0, 200))
  return JSON.parse(match[0])
}

// ── Shared input style ────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  fontSize: 13, width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--fg-1)', padding: '8px 10px', fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s',
}
const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = 'var(--blue-500)')
const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = 'var(--border)')

// ── Form field component ──────────────────────────────────────────────────
function FF({ label, optional, hint, type = 'text', placeholder, value, onChange, maxLength }: {
  label: string; optional?: boolean; hint?: string; type?: string
  placeholder?: string; value: string; onChange: (v: string) => void; maxLength?: number
}) {
  const atLimit = maxLength !== undefined && value.length >= maxLength
  const nearLimit = maxLength !== undefined && value.length >= maxLength - 10
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {optional && <span style={{ fontSize: 10, background: 'var(--bg-subtle, #f4f6f9)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--fg-3)' }}>optional</span>}
        {maxLength !== undefined && <span style={{ marginLeft: 'auto', fontSize: 10, color: atLimit ? 'var(--red-600)' : nearLimit ? 'var(--amber-700)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{value.length}/{maxLength}</span>}
      </label>
      {type === 'textarea'
        ? <textarea placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onFocus={focusBorder} onBlur={blurBorder} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} />
        : <input type={type} placeholder={placeholder} value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} onFocus={focusBorder} onBlur={blurBorder} style={{ ...inputStyle, borderColor: atLimit ? 'var(--red-400, #f87171)' : undefined }} />
      }
      {hint && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{hint}</span>}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────
function SH({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-3)', margin: '18px 0 10px', paddingBottom: 7, borderBottom: '1px solid var(--border)' }}>{children}</div>
}

function G2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>{children}</div>
}
function G3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>{children}</div>
}

// ── Campaign name preview ─────────────────────────────────────────────────
const NAME_MAX = 80
function Preview({ name }: { name: string | null }) {
  if (!name) return null
  const over = name.length > NAME_MAX
  const near = !over && name.length >= NAME_MAX - 10
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: over ? 'var(--red-600)' : 'var(--blue-600)', background: over ? '#fef2f2' : '#eff6ff', border: `1px solid ${over ? '#fecaca' : '#bfdbfe'}`, borderRadius: 7, padding: '7px 11px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span>{name}</span>
      <span style={{ fontWeight: 400, fontSize: 11, color: over ? 'var(--red-600)' : near ? 'var(--amber-700)' : 'var(--fg-3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{name.length}/{NAME_MAX}</span>
    </div>
  )
}

// ── Form variants ─────────────────────────────────────────────────────────
function DMForm({ d, s }: { d: FormData; s: (k: string, v: string) => void }) {
  return <>
    <SH>Campaign details</SH>
    <G2><FF label="Short campaign name" placeholder="e.g. ANZ Boarding Managers" value={d.name || ''} onChange={v => s('name', v)} maxLength={62} /><FF label="Start date" type="date" value={d.start || ''} onChange={v => s('start', v)} /></G2>
    <Preview name={fmtName('DM', d.name, d.start)} />
    <FF label="Campaign description" optional type="textarea" placeholder="Brief description — will be drafted if blank" value={d.desc || ''} onChange={v => s('desc', v)} />
    <SH>Sequence settings</SH>
    <G3>
      <FF label="Follow-up sequence ID" placeholder="e.g. 123456789" hint="Single numeric ID" value={d.seqid || ''} onChange={v => s('seqid', v)} />
      <FF label="Sequence delay (days)" type="number" placeholder="e.g. 3" hint="Days after DM is sent" value={d.delay || ''} onChange={v => s('delay', v)} />
      <FF label="Conversion window (days)" type="number" placeholder="e.g. 30" hint="Days for attribution" value={d.conv || ''} onChange={v => s('conv', v)} />
    </G3>
  </>
}

function WBForm({ d, s }: { d: FormData; s: (k: string, v: string) => void }) {
  return <>
    <SH>Campaign details</SH>
    <G2><FF label="Webinar name" placeholder="e.g. School Safety in the Digital Age" value={d.name || ''} onChange={v => s('name', v)} maxLength={62} /><FF label="Webinar date" type="date" value={d.date || ''} onChange={v => s('date', v)} /></G2>
    <Preview name={fmtName('WB', d.name, d.date)} />
    <FF label="Campaign description" optional type="textarea" placeholder="Brief description — will be drafted if blank" value={d.desc || ''} onChange={v => s('desc', v)} />
    <SH>Zoom & registration</SH>
    <G2><FF label="Zoom webinar ID" placeholder="e.g. 87171440658" hint="Numbers only" value={d.zoomid || ''} onChange={v => s('zoomid', v)} /><FF label="Landing page path" placeholder="/events/webinar-name" value={d.lpath || ''} onChange={v => s('lpath', v)} /></G2>
    <SH>On-demand</SH>
    <G2><FF label="On-demand URL" placeholder="https://www.orah.com/ep/webinar-name" hint="Placeholder URL is fine" value={d.odurl || ''} onChange={v => s('odurl', v)} /><FF label="On-demand email subject" optional placeholder='Default: "Webinar Recording: [name]"' value={d.odsub || ''} onChange={v => s('odsub', v)} /></G2>
  </>
}

function EVForm({ d, s }: { d: FormData; s: (k: string, v: string) => void }) {
  return <>
    <SH>Campaign details</SH>
    <G2><FF label="Event name" placeholder="e.g. BSME Dubai 2026" value={d.name || ''} onChange={v => s('name', v)} maxLength={62} /><FF label="Promotion start date" type="date" value={d.promo || ''} onChange={v => s('promo', v)} /></G2>
    <G2><FF label="Event start date" type="date" value={d.start || ''} onChange={v => s('start', v)} /><FF label="Event end date" type="date" value={d.end || ''} onChange={v => s('end', v)} /></G2>
    <Preview name={fmtName('EV', d.name, d.start)} />
    <FF label="Campaign description" optional type="textarea" placeholder="Brief description — will be drafted if blank" value={d.desc || ''} onChange={v => s('desc', v)} />
    <SH>Sequences</SH>
    <G3>
      <FF label="Pre-event sequence IDs" placeholder="e.g. 123456, 789012" hint="Comma-separated" value={d.pre || ''} onChange={v => s('pre', v)} />
      <FF label="At-event sequence IDs" optional placeholder="e.g. 345678" hint="Comma-separated" value={d.at || ''} onChange={v => s('at', v)} />
      <FF label="Post-event sequence IDs" placeholder="e.g. 567890" hint="Comma-separated" value={d.post || ''} onChange={v => s('post', v)} />
    </G3>
  </>
}

// ── Spinner ───────────────────────────────────────────────────────────────
function Spin() {
  return <svg style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="none" stroke="var(--blue-500)" strokeWidth="1.5" strokeDasharray="20 10" />
  </svg>
}

// ── Primary / secondary buttons ───────────────────────────────────────────
function BtnP({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: disabled ? 'var(--border)' : 'var(--blue-500)', color: disabled ? 'var(--fg-3)' : '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'inherit', transition: 'opacity .15s', whiteSpace: 'nowrap' }}>{children}</button>
}
function BtnS({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: 'var(--bg)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}>{children}</button>
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function CampaignSetupPage() {
  const [type, setType] = useState<CampaignType | null>(null)
  const [fd, setFd] = useState<FormData>({})
  const [showErr, setShowErr] = useState(false)
  const [stage, setStage] = useState<Stage>('form')
  const [conf, setConf] = useState<ConfirmedData | null>(null)
  const [result, setResult] = useState<{ assetsCreated: Asset[] } | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [chk, setChk] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editVals, setEditVals] = useState<Record<string, string>>({})

  const set = (k: string, v: string) => setFd(p => ({ ...p, [k]: v }))

  const reset = (t: CampaignType | null) => {
    setType(t); setFd({}); setShowErr(false); setStage('form')
    setConf(null); setResult(null); setErrMsg(null); setChk({}); setCopied(false)
    setEditMode(false); setEditVals({})
  }

  const handleSubmit = async () => {
    if (!type || !isReady(type, fd)) { setShowErr(true); return }
    setShowErr(false); setStage('confirming')
    try {
      const p = await callAI(buildMsg(type, fd))
      setConf({ ...p, _type: type })
      setStage('confirmed')
    } catch (e) {
      setErrMsg('Failed to process form: ' + (e as Error).message)
      setStage('error')
    }
  }

  const handleTrigger = async () => {
    if (!conf) return
    setStage('triggering')
    try {
      const r = await fetch('/api/campaign-setup/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: conf._type, campaignName: conf.campaignName, summary: conf.summary }),
      })
      const p = await r.json()
      if (p.status === 'success') {
        const raw = Array.isArray(p.n8nResponse) ? p.n8nResponse[0] : p.n8nResponse
        setResult({ assetsCreated: raw?.assetsCreated || [] })
        setStage('done')
      } else {
        setErrMsg(p.error || 'Workflow error.')
        setStage('error')
      }
    } catch (e) {
      setErrMsg('Failed to trigger workflow: ' + (e as Error).message)
      setStage('error')
    }
  }

  const startEdit = () => { setEditVals({ campaignName: conf!.campaignName, ...conf!.summary }); setEditMode(true) }
  const saveEdit = () => {
    const { campaignName: newName, ...rest } = editVals
    setConf(p => p ? { ...p, campaignName: newName, summary: rest } : p)
    setEditMode(false)
  }

  const buildMarkdown = () => {
    const acts = ACTIONS[conf?._type ?? 'dm'] || []
    let md = `# ${conf?.campaignName}\n\n## Campaign details\n\n| Field | Value |\n|---|---|\n| Campaign name | ${conf?.campaignName} |\n`
    Object.entries(conf?.summary || {}).forEach(([k, v]) => { md += `| ${k} | ${v || '—'} |\n` })
    md += `\n## Assets created\n\n`
    const assets = result?.assetsCreated || []
    if (assets.length) assets.forEach(a => { const lnk = assetLink(a.type, a.id); md += `- **${a.type}:** ${lnk ? `[${a.name}](${lnk})` : a.name}\n` })
    else md += `_No assets returned._\n`
    md += `\n## Manual actions required\n\n`
    let aidx = 0
    acts.forEach((sec, si) => {
      md += `**${sec.title}**\n\n`
      sec.items.forEach(item => { const k = `${si}-${aidx++}`; md += chk[k] ? `- ~~${item}~~\n` : `- [ ] ${item}\n` })
      md += `\n`
    })
    return md.trim()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown())
    } catch {
      const el = document.createElement('textarea')
      el.value = buildMarkdown()
      el.style.cssText = 'position:fixed;top:-9999px;opacity:0;'
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  // ── Renders ──────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 18px', marginBottom: 12 }

  const renderForm = () => (
    <>
      {/* Campaign type picker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 22 }}>
        {CAMPAIGN_TYPES.map(ct => (
          <button key={ct.id} onClick={() => reset(ct.id)} style={{ padding: '12px 10px', border: type === ct.id ? '1.5px solid var(--blue-500)' : '1px solid var(--border)', borderRadius: 10, background: type === ct.id ? '#eff6ff' : 'var(--bg)', cursor: 'pointer', fontSize: 13, color: type === ct.id ? 'var(--blue-600)' : 'var(--fg-2)', textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit', fontWeight: type === ct.id ? 600 : 400 }}>
            {ct.label}
            <span style={{ fontSize: 10, display: 'block', marginTop: 3, color: type === ct.id ? 'var(--blue-500)' : 'var(--fg-3)', fontWeight: 400 }}>{ct.sub}</span>
          </button>
        ))}
      </div>

      {!type
        ? <div style={{ color: 'var(--fg-3)', fontSize: 13, padding: '2rem 0', textAlign: 'center' }}>Select a campaign type above to get started.</div>
        : <>
          {type === 'dm' && <DMForm d={fd} s={set} />}
          {type === 'wb' && <WBForm d={fd} s={set} />}
          {type === 'ev' && <EVForm d={fd} s={set} />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
            <BtnP onClick={handleSubmit}>Review & confirm →</BtnP>
            <BtnS onClick={() => reset(type)}>Clear</BtnS>
            {showErr && <span style={{ fontSize: 12, color: 'var(--red-600)' }}>Please fill in all required fields.</span>}
          </div>
        </>
      }
    </>
  )

  const renderConfirmed = () => {
    if (!conf) return null
    const { campaignName, campaignType, summary = {}, warnings = [], descriptionWasDrafted, descriptionWasPolished } = conf
    const niStyle: React.CSSProperties = { ...inputStyle, fontSize: 13 }
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          Review campaign
          <span style={{ fontSize: 11, background: '#eff6ff', color: 'var(--blue-600)', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{campaignType}</span>
        </div>

        <div style={cardStyle}>
          {/* Campaign name row */}
          <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: 'var(--fg-2)', minWidth: 190, flexShrink: 0 }}>Campaign name</span>
            {editMode
              ? <input style={{ ...niStyle, fontWeight: 600 }} value={editVals.campaignName || ''} onChange={e => setEditVals(p => ({ ...p, campaignName: e.target.value }))} onFocus={focusBorder} onBlur={blurBorder} />
              : <span style={{ color: 'var(--blue-600)', fontWeight: 600 }}>{campaignName}</span>
            }
          </div>

          {/* Summary rows */}
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', fontSize: 13, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--fg-2)', minWidth: 190, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {k}
                {k === 'Campaign description' && descriptionWasDrafted && <span style={{ fontSize: 10, background: '#fffbeb', color: 'var(--amber-700)', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>drafted</span>}
                {k === 'Campaign description' && descriptionWasPolished && <span style={{ fontSize: 10, background: '#fffbeb', color: 'var(--amber-700)', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>polished</span>}
              </span>
              {editMode
                ? k === 'Campaign description'
                  ? <textarea style={{ ...niStyle, minHeight: 60, resize: 'vertical' }} value={editVals[k] || ''} onChange={e => setEditVals(p => ({ ...p, [k]: e.target.value }))} onFocus={focusBorder} onBlur={blurBorder} />
                  : <input style={niStyle} value={editVals[k] || ''} onChange={e => setEditVals(p => ({ ...p, [k]: e.target.value }))} onFocus={focusBorder} onBlur={blurBorder} />
                : <span style={{ color: 'var(--fg-1)' }}>{v || '—'}</span>
              }
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--amber-700)' }}>
            {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          {editMode
            ? <><BtnP onClick={saveEdit}>Save changes</BtnP><BtnS onClick={() => setEditMode(false)}>Cancel</BtnS></>
            : <><BtnP onClick={handleTrigger} disabled={stage === 'triggering'}>Confirm & trigger workflow →</BtnP><BtnS onClick={startEdit} disabled={stage === 'triggering'}>Edit</BtnS></>
          }
        </div>
      </div>
    )
  }

  const renderDone = () => {
    if (!conf) return null
    const acts = ACTIONS[conf._type] || []
    let idx = 0
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: 'var(--green-700)', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Setup complete
          </span>
          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{conf.campaignName}</span>
        </div>

        {(result?.assetsCreated?.length ?? 0) > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--fg-3)', marginBottom: 8 }}>Assets created</div>
            <div style={cardStyle}>
              {result!.assetsCreated.map((a, i) => {
                const lnk = assetLink(a.type, a.id)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < result!.assetsCreated.length - 1 ? '1px solid var(--border-subtle, #f0f0f0)' : 'none', fontSize: 13 }}>
                    <div><span style={{ color: 'var(--fg-3)', marginRight: 8 }}>{a.type}</span><span style={{ color: 'var(--fg-1)' }}>{a.name}</span></div>
                    {lnk && <a href={lnk} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--blue-500)', textDecoration: 'none', fontWeight: 600 }}>Open →</a>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {acts.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--fg-3)', marginBottom: 8, marginTop: 8 }}>Manual actions required</div>
            <div style={cardStyle}>
              {acts.map((sec, si) => (
                <div key={si}>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: si === 0 ? '0 0 4px' : '12px 0 4px', fontWeight: 700 }}>{sec.title}</div>
                  {sec.items.map(item => {
                    const k = `${si}-${idx++}`
                    const done = chk[k]
                    return (
                      <div key={k} onClick={() => setChk(p => ({ ...p, [k]: !p[k] }))} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', cursor: 'pointer' }}>
                        <div style={{ width: 15, height: 15, borderRadius: 4, border: done ? '1px solid var(--blue-500)' : '1px solid var(--border)', background: done ? '#eff6ff' : 'var(--bg)', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                          {done && <svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2" stroke="var(--blue-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                        </div>
                        <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--fg-3)' : 'var(--fg-1)' }}>{item}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Save to Notion */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--fg-3)', marginBottom: 8 }}>Save to Notion</div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 10 }}>Copy the campaign summary as markdown and paste it into any Notion page.</div>
          <BtnS onClick={handleCopy}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {copied
                ? <><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><polyline points="1.5,6.5 5,10 11.5,3" stroke="var(--green-700)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg><span style={{ color: 'var(--green-700)' }}>Copied!</span></>
                : <><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="1" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="1" y="4" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" /></svg>Copy summary</>
              }
            </span>
          </BtnS>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <BtnS onClick={() => reset(null)}>Set up another campaign</BtnS>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {stage === 'form' && renderForm()}

      {stage === 'confirming' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2.5rem 0', color: 'var(--fg-2)', fontSize: 13 }}>
          <Spin />Processing form data…
        </div>
      )}

      {(stage === 'confirmed' || stage === 'triggering') && renderConfirmed()}

      {stage === 'triggering' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem 0', color: 'var(--fg-2)', fontSize: 13 }}>
          <Spin />Finding and triggering n8n workflow…
        </div>
      )}

      {stage === 'done' && renderDone()}

      {stage === 'error' && (
        <div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--red-600)' }}>
            {errMsg || 'Something went wrong.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnS onClick={() => setStage(conf ? 'confirmed' : 'form')}>Go back</BtnS>
            {conf && <BtnP onClick={handleTrigger}>Retry →</BtnP>}
          </div>
        </div>
      )}
    </div>
  )
}
