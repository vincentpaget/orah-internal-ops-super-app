// Date-only helpers on 'YYYY-MM-DD' strings. Pure arithmetic, no Date/timezone involved,
// so "1 Nov 2026" never drifts to "31 Oct 2026" in a browser west of UTC.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface YMD { y: number; m: number; d: number }

function parse(iso: string): YMD {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function toIso({ y, m, d }: YMD): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parse(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return toIso({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) })
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12)
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parse(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return toIso({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() })
}

/** Whole months from `from` to `to` (0 if `to` is not after `from`). */
export function monthsBetween(from: string, to: string): number {
  const a = parse(from)
  const b = parse(to)
  let months = (b.y - a.y) * 12 + (b.m - a.m)
  if (b.d < a.d) months -= 1
  return Math.max(0, months)
}

/** First occurrence of the school year start ('MM-DD') on or after `iso`. */
export function schoolYearStartOnOrAfter(iso: string, mmdd: string): string {
  const { y } = parse(iso)
  const candidate = `${y}-${mmdd}`
  return candidate >= iso ? candidate : `${y + 1}-${mmdd}`
}

/** "21 October 2026" */
export function formatLong(iso: string): string {
  if (!isIsoDate(iso)) return ''
  const { y, m, d } = parse(iso)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "1 Nov 2026" */
export function formatShort(iso: string): string {
  if (!isIsoDate(iso)) return ''
  const { y, m, d } = parse(iso)
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`
}

/** "1 July" from 'MM-DD' */
export function formatDayMonth(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** "Nov–Jun": month of `from` to the month before `toExclusive`. */
export function monthRange(from: string, toExclusive: string): string {
  if (!isIsoDate(from) || !isIsoDate(toExclusive)) return ''
  const start = MONTHS[parse(from).m - 1].slice(0, 3)
  const end = MONTHS[parse(addMonths(toExclusive, -1)).m - 1].slice(0, 3)
  return start === end ? start : `${start}–${end}`
}

export function todayIso(): string {
  const now = new Date()
  return toIso({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() })
}

export function firstOfNextMonth(iso: string): string {
  const { y, m } = parse(iso)
  return addMonths(toIso({ y, m, d: 1 }), 1)
}

/** "21 October 2026" or "1 Nov 2026" → '2026-10-21'. Empty string if it doesn't parse. */
export function parseDisplayDate(s: string): string {
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/)
  if (!m) return ''
  const month = MONTHS.findIndex(name => name.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)))
  const d = Number(m[1])
  if (month < 0 || d < 1 || d > 31) return ''
  return toIso({ y: Number(m[3]), m: month + 1, d })
}
