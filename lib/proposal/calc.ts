// Offer calculations for the proposal brief. Every figure in the brief comes from here;
// the downstream Claude skill never calculates prices.

import type { CurrencyCode } from '../pricing/data'
import type { OfferType } from './config'
import { addDays, addYears, monthRange, monthsBetween, schoolYearStartOnOrAfter } from './dates'

export interface LineItem {
  product: string
  qty: number
  unitPrice: number
}

export interface OfferInput {
  currency: CurrencyCode
  lines: LineItem[]
  /** One-time fees, onboarding first, then any additional fees (SMS credits, hardware): qty = packs. Due at signature. */
  oneTimeFees: LineItem[]
  /** One discount per offer for all one-time fees, applied to their sum. */
  oneTimeDiscountPct: Record<OfferType, number>
  /** School year start as 'MM-DD', e.g. '07-01'. */
  schoolYearStart: string
  termYears: number
  /** Start / access date, 'YYYY-MM-DD' (always the 1st of a month). */
  startDate: string
  include: Record<OfferType, boolean>
  discountPct: Record<OfferType, number>
}

export interface ScheduleRow {
  date: string
  amount: number
}

export interface OneTimeFeeFigures {
  lines: LineItem[]
  list: number
  discountPct: number
  discountAmount: number
  total: number
}

export interface ComputedOffer {
  letter: 'a' | 'b'
  type: OfferType
  startOrAccessDate: string
  billingStarts: string
  paidTermMonths: number
  discountPct: number
  discountAmount: number
  annual: number
  /** Standard only, when Funded is also included: funded annual − standard annual. */
  annualSaving?: number
  /** Standard only: months of pro-rated stub before the school year start. */
  stubMonths: number
  stub: number
  /** Standard only: pro-rated months from the start date to the month before the school year start, e.g. "Jan–Jun". Omitted when there is no stub. */
  proratedPeriod?: string
  /** Funded only: free access from the access date until billing starts, e.g. "Nov–Jun". */
  earlyAccessPeriod?: string
  /** Onboarding plus any other one-time fees, with this option's one-time fees discount. */
  oneTimeFees: OneTimeFeeFigures
  dueAtSignature: number
  schedule: ScheduleRow[]
}

export interface OfferResult {
  listTotal: number
  schoolYearStartDate: string
  contractEnd: string
  fundedAllowed: boolean
  options: ComputedOffer[]
  /** Funded billing start if Funded is included, else the Standard start date. */
  defaultGoLive: string
}

export function lineAnnual(l: LineItem): number {
  return l.qty * l.unitPrice
}

export function computeOffers(input: OfferInput): OfferResult {
  const listTotal = input.lines.reduce((s, l) => s + lineAnnual(l), 0)
  const schoolYearStartDate = schoolYearStartOnOrAfter(input.startDate, input.schoolYearStart)
  const contractEnd = addDays(addYears(schoolYearStartDate, input.termYears), -1)
  const fundedAllowed = input.startDate < schoolYearStartDate

  const feeLines = input.oneTimeFees.filter(l => l.qty > 0)
  const feeList = feeLines.reduce((s, l) => s + lineAnnual(l), 0)
  const oneTimeFeesFor = (type: OfferType): OneTimeFeeFigures => {
    const discountPct = input.oneTimeDiscountPct[type]
    const discountAmount = Math.round(feeList * discountPct / 100)
    return { lines: feeLines, list: feeList, discountPct, discountAmount, total: feeList - discountAmount }
  }

  const schedule = (annual: number): ScheduleRow[] =>
    Array.from({ length: input.termYears }, (_, i) => ({ date: addYears(schoolYearStartDate, i), amount: annual }))

  const priced = (type: OfferType) => {
    const discountPct = input.discountPct[type]
    const discountAmount = Math.round(listTotal * discountPct / 100)
    return { discountPct, discountAmount, annual: listTotal - discountAmount }
  }

  const types: OfferType[] = []
  if (input.include.standard) types.push('standard')
  if (input.include.funded && fundedAllowed) types.push('funded')

  const options: ComputedOffer[] = types.map((type, i) => {
    const p = priced(type)
    const oneTimeFees = oneTimeFeesFor(type)
    const letter = i === 0 ? 'a' : 'b'
    if (type === 'standard') {
      const stubMonths = monthsBetween(input.startDate, schoolYearStartDate)
      const stub = Math.round(p.annual * stubMonths / 12)
      return {
        letter,
        type,
        startOrAccessDate: input.startDate,
        billingStarts: input.startDate,
        paidTermMonths: monthsBetween(input.startDate, addDays(contractEnd, 1)),
        ...p,
        stubMonths,
        stub,
        proratedPeriod: stubMonths > 0 ? monthRange(input.startDate, schoolYearStartDate) : undefined,
        oneTimeFees,
        dueAtSignature: oneTimeFees.total + stub,
        schedule: schedule(p.annual),
      }
    }
    return {
      letter,
      type,
      startOrAccessDate: input.startDate,
      billingStarts: schoolYearStartDate,
      paidTermMonths: input.termYears * 12,
      ...p,
      stubMonths: 0,
      stub: 0,
      earlyAccessPeriod: monthRange(input.startDate, schoolYearStartDate) || undefined,
      oneTimeFees,
      dueAtSignature: oneTimeFees.total,
      schedule: schedule(p.annual),
    }
  })

  const standard = options.find(o => o.type === 'standard')
  const funded = options.find(o => o.type === 'funded')
  if (standard && funded) standard.annualSaving = funded.annual - standard.annual

  return {
    listTotal,
    schoolYearStartDate,
    contractEnd,
    fundedAllowed,
    options,
    defaultGoLive: funded ? funded.billingStarts : input.startDate,
  }
}
