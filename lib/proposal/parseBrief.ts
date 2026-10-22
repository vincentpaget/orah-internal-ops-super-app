// Reads a PROPOSAL BRIEF (as rendered by renderBrief in ./brief) back into calculator
// selections and offer details, so a sent proposal can be revised. The format is fixed by
// renderBrief, so this is a line reader rather than a YAML parser: change them together.

import { MIN_STUDENTS, getPrice } from '../pricing/calc'
import { ONE_TIME_FEES, TIERS, type CurrencyCode, type Platform, type Prices } from '../pricing/data'
import { BRIEF_SYMBOLS, BRIEF_TIER_NAMES, briefAddonName, briefOnboardingName, type OfferType } from './config'
import { isIsoDate, parseDisplayDate, schoolYearStartOnOrAfter } from './dates'

export interface ParsedCalculator {
  platform: Platform
  currency: CurrencyCode
  studentCount: number
  tierId: string
  /** addon id → quantity (students for per-student add-ons, 1 for flat) */
  addons: Record<string, number>
  /** one-time fee id → packs (onboarding excluded: it comes from the tier) */
  oneTimeFees: Record<string, number>
}

export interface ParsedDetails {
  schoolName: string
  contactName: string
  contactTitle: string
  repName: string
  repEmail: string
  opportunityId: string
  opportunityName: string
  sis: string
  /** School year start month, 1–12 */
  schoolYearMonth: number
  termYears: number
  startDate: string
  include: Record<OfferType, boolean>
  recommended: OfferType
  discountPct: Record<OfferType, number>
  oneTimeDiscountPct: Record<OfferType, number>
  /** Explicit sign-by date, or null when it followed the expiry date (or has passed) */
  signByDate: string | null
  kickoffDate: string
  setupWindow: string
  trainingWindow: string
  notes: string
  /** Explicit go-live date, or null when it was the default */
  goLiveDate: string | null
}

export interface ParsedBrief {
  calculator: ParsedCalculator
  details: ParsedDetails
  /** Things the rep should check: skipped products, changed list prices, dates reset. */
  warnings: string[]
}

interface Row {
  product: string
  qty: number
  unitPrice: number
}

interface RawOption {
  letter: string
  type: OfferType | ''
  fields: Record<string, string>
  lines: Row[]
  fees: Row[]
  feeFields: Record<string, string>
  scheduleRows: number
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Undo yamlScalar's double quoting. */
function unquote(s: string): string {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\(["\\])/g, '$1')
  }
  return t
}

/** "$6,000.00" / "NZ$30.00" → 6000 / 30 */
function parseMoney(s: string): number {
  return Number(s.replace(/[^\d.]/g, '')) || 0
}

function parsePct(s: string | undefined): number {
  return s ? parseInt(s, 10) || 0 : 0
}

/** One flow-mapping row: {product: X, qty: N, unit_price: $N.NN, annual|list: $N} */
function parseRow(s: string): Row | null {
  const m = s.match(/^\{product: (.*?), qty: (\d+), unit_price: (.*?), (?:annual|list): /)
  if (!m) return null
  return { product: unquote(m[1]), qty: Number(m[2]), unitPrice: parseMoney(m[3]) }
}

function findTierByName(name: string): { platform: Platform; tierId: string } | null {
  for (const [key, label] of Object.entries(BRIEF_TIER_NAMES)) {
    if (label === name) {
      const [platform, tierId] = key.split(':')
      return { platform: platform as Platform, tierId }
    }
  }
  return null
}

const samePrice = (a: number, b: number) => Math.abs(a - b) < 0.005

export function parseBrief(text: string, today: string): ParsedBrief {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex(l => l.trim() === 'PROPOSAL BRIEF')
  if (start < 0) throw new Error('This doesn’t look like a proposal brief. Paste the full text, starting with “PROPOSAL BRIEF”.')

  const proposal: Record<string, string> = {}
  const rollout: Record<string, string> = {}
  const options: RawOption[] = []
  let section = ''
  let sub = '' // within an option: line_items | one_time_fees | items | schedule

  for (const raw of lines.slice(start + 1)) {
    if (!raw.trim()) continue
    const indent = raw.length - raw.trimStart().length
    const line = raw.trim()

    if (indent === 0) {
      section = line.replace(/:$/, '')
      sub = ''
      continue
    }

    if (section === 'options') {
      const opt = options[options.length - 1]
      if (indent === 2 && line.startsWith('- letter:')) {
        options.push({ letter: line.slice('- letter:'.length).trim(), type: '', fields: {}, lines: [], fees: [], feeFields: {}, scheduleRows: 0 })
        sub = ''
        continue
      }
      if (!opt) continue
      if (line.startsWith('- {')) {
        if (sub === 'schedule') opt.scheduleRows++
        const row = parseRow(line.slice(2))
        if (row && sub === 'line_items') opt.lines.push(row)
        if (row && sub === 'items') opt.fees.push(row)
        continue
      }
      const kv = line.match(/^([a-z_]+):\s*(.*)$/)
      if (!kv) continue
      const [, key, value] = kv
      if (indent === 4) {
        sub = value === '' ? key : ''
        if (key === 'type') opt.type = value === 'funded' ? 'funded' : 'standard'
        else if (value !== '') opt.fields[key] = unquote(value)
      } else if (indent === 6 && (sub === 'one_time_fees' || sub === 'items')) {
        if (key === 'items') sub = 'items'
        else { opt.feeFields[key] = unquote(value); sub = 'one_time_fees' }
      }
      continue
    }

    const kv = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!kv) continue
    if (section === 'proposal') proposal[kv[1]] = unquote(kv[2])
    if (section === 'rollout') rollout[kv[1]] = unquote(kv[2])
  }

  const warnings: string[] = []

  const currency = proposal.currency as CurrencyCode
  if (!(currency in BRIEF_SYMBOLS)) throw new Error(`Unknown currency “${proposal.currency ?? ''}” in the brief.`)
  if (options.length === 0) throw new Error('No offer options found in the brief.')

  // ── Products (taken from the first option: every option has the same lines) ──
  const first = options[0]
  const tierRow = first.lines.find(r => findTierByName(r.product))
  const tierRef = tierRow && findTierByName(tierRow.product)
  if (!tierRow || !tierRef) throw new Error('Couldn’t find a plan tier (e.g. “Supervise 2 (Pro)”) in the line items.')
  const tier = TIERS[tierRef.platform].find(t => t.id === tierRef.tierId)!
  const studentCount = Math.max(MIN_STUDENTS, tierRow.qty)

  const skipped: string[] = []
  const repriced: string[] = []
  const checkPrice = (row: Row, prices: Prices) => {
    if (!samePrice(row.unitPrice, getPrice(prices, currency))) repriced.push(row.product)
  }
  checkPrice(tierRow, tier.prices)

  const addons: Record<string, number> = {}
  for (const row of first.lines) {
    if (row === tierRow) continue
    const addon = tier.addons.find(a => briefAddonName(a.name) === row.product)
    if (!addon) { skipped.push(row.product); continue }
    addons[addon.id] = addon.perStudent ? row.qty : 1
    checkPrice(row, addon.prices)
  }

  const oneTimeFees: Record<string, number> = {}
  for (const row of first.fees) {
    if (row.product === briefOnboardingName(tier.onboarding.name)) { checkPrice(row, tier.onboarding.prices); continue }
    if (/^Onboarding\b/.test(row.product)) {
      warnings.push(`${row.product} replaced with ${briefOnboardingName(tier.onboarding.name)}, the onboarding for ${tier.name}.`)
      continue
    }
    const fee = ONE_TIME_FEES.find(f => f.name === row.product)
    if (!fee) { skipped.push(row.product); continue }
    oneTimeFees[fee.id] = row.qty
    checkPrice(row, fee.prices)
  }

  if (skipped.length) warnings.push(`Not in the current price list, so left out: ${skipped.join(', ')}. Add a replacement in the calculator if needed.`)
  if (repriced.length) warnings.push(`List prices have changed since this proposal, so these are now at current prices: ${repriced.join(', ')}.`)

  // ── Offer details ──
  const include: Record<OfferType, boolean> = { standard: false, funded: false }
  const discountPct: Record<OfferType, number> = { standard: 0, funded: 0 }
  const oneTimeDiscountPct: Record<OfferType, number> = { standard: 0, funded: 0 }
  for (const o of options) {
    if (!o.type) continue
    include[o.type] = true
    discountPct[o.type] = parsePct(o.fields.discount_pct)
    oneTimeDiscountPct[o.type] = parsePct(o.feeFields.discount_pct)
  }

  const recLetter = rollout.recommended_option?.match(/^Option ([AB])\b/i)?.[1].toLowerCase()
  const recType = options.find(o => o.letter === recLetter)?.type
  const recommended: OfferType = recType || 'funded'

  const syMatch = proposal.school_year_start?.match(/^\d{1,2} ([A-Za-z]+)$/)
  const syIndex = syMatch ? MONTHS.indexOf(syMatch[1].toLowerCase()) : -1
  const schoolYearMonth = syIndex >= 0 ? syIndex + 1 : 7
  const startDate = parseDisplayDate(first.fields.start_or_access_date ?? '')
  const termYears = Math.min(3, Math.max(1, first.scheduleRows || 1))

  const expiry = parseDisplayDate(proposal.expiry_date ?? '')
  const signBy = parseDisplayDate((rollout.sign_by ?? '').replace(/^By /, ''))
  let signByDate: string | null = null
  if (signBy && signBy !== expiry) {
    if (signBy < today) warnings.push('The original sign-by date has passed, so it now follows the new expiry date.')
    else signByDate = signBy
  }

  const goLive = parseDisplayDate(rollout.go_live_date ?? '')
  const defaultGoLive = isIsoDate(startDate)
    ? include.funded ? schoolYearStartOnOrAfter(startDate, `${String(schoolYearMonth).padStart(2, '0')}-01`) : startDate
    : ''
  const goLiveDate = goLive && goLive !== defaultGoLive ? goLive : null

  if (isIsoDate(startDate) && startDate < today) warnings.push('The start / access date is in the past. Check it before regenerating.')

  return {
    calculator: { platform: tierRef.platform, currency, studentCount, tierId: tierRef.tierId, addons, oneTimeFees },
    details: {
      schoolName: proposal.school_name ?? '',
      contactName: proposal.contact_name ?? '',
      contactTitle: proposal.contact_title ?? '',
      repName: proposal.rep_name ?? '',
      repEmail: proposal.rep_email ?? '',
      opportunityId: proposal.salesforce_opportunity_id ?? '',
      opportunityName: proposal.salesforce_opportunity_name ?? '',
      sis: proposal.sis ?? '',
      schoolYearMonth,
      termYears,
      startDate,
      include,
      recommended,
      discountPct,
      oneTimeDiscountPct,
      signByDate,
      kickoffDate: parseDisplayDate(rollout.kickoff_date ?? ''),
      setupWindow: rollout.setup_window ?? '',
      trainingWindow: rollout.training_window ?? '',
      notes: rollout.notes ?? '',
      goLiveDate,
    },
    warnings,
  }
}
