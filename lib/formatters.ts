import type { HealthGrade, StageName } from './types'
import { STAGE_DISPLAY } from './types'

export function fmtCurrency(amount: number | null | undefined, code: string): string {
  if (amount == null) return '—'
  return `${code} ${new Intl.NumberFormat('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`
}

export function nzd(amount: number | null | undefined, decimals = 0): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function shortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function isOverdue(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false
  return new Date(isoDate + 'T00:00:00') < new Date()
}

export function stageLabel(stageName: string): string {
  return STAGE_DISPLAY[stageName as StageName] ?? stageName
}

export function gradeFromFlagRate(flagged: number, total: number): HealthGrade {
  if (total === 0) return 'A'
  const rate = flagged / total
  if (rate === 0) return 'A'
  if (rate <= 0.25) return 'B'
  if (rate <= 0.5) return 'C'
  if (rate <= 0.75) return 'D'
  return 'F'
}

export function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const diff = Date.now() - new Date(isoDate + 'T00:00:00').getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
