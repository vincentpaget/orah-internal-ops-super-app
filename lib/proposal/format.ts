import type { CurrencyCode } from '../pricing/data'
import { BRIEF_SYMBOLS } from './config'

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const TWO_DP = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Totals: "$25,398" */
export function money(amount: number, currency: CurrencyCode): string {
  return BRIEF_SYMBOLS[currency] + WHOLE.format(Math.round(amount))
}

/** Unit prices: "$30.00" */
export function unitMoney(amount: number, currency: CurrencyCode): string {
  return BRIEF_SYMBOLS[currency] + TWO_DP.format(amount)
}

export function pct(n: number): string {
  return `${n}%`
}

/** "32 months" */
export function months(n: number): string {
  return `${n} month${n === 1 ? '' : 's'}`
}

const SPECIAL_START = /^[-?:,[\]{}#&*!|>'"%@`\s]/

/**
 * Quote a YAML value when it contains ": " or starts with a special character.
 * In flow mappings ({a: b, c: d}) values containing ", " are quoted too.
 */
export function yamlScalar(value: string, inFlow = false): string {
  const needsQuote =
    value === '' ||
    value.includes(': ') ||
    value.includes(' #') ||
    value.endsWith(':') ||
    SPECIAL_START.test(value) ||
    /\s$/.test(value) ||
    (inFlow && /[,{}[\]]/.test(value.replace(/\d,\d/g, '')))
  if (!needsQuote) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
