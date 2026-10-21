import { CURRENCIES, PLATFORM_LABELS, TIERS, type Addon, type CurrencyCode, type Platform, type Prices, type Tier } from './data'

export const MIN_STUDENTS = 250

export function getPrice(prices: Prices, currency: CurrencyCode): number {
  return prices[currency] ?? prices.USD
}

export function currencySymbol(currency: CurrencyCode): string {
  return CURRENCIES.find(c => c.code === currency)?.symbol ?? '$'
}

export function currencyName(currency: CurrencyCode): string {
  return CURRENCIES.find(c => c.code === currency)?.name ?? currency
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return currencySymbol(currency) + amount.toLocaleString()
}

/** "+$6/student/year" or "+$1,500/year" */
export function formatAddonPrice(addon: Addon, currency: CurrencyCode): string {
  return '+' + formatMoney(getPrice(addon.prices, currency), currency) + (addon.perStudent ? '/student/year' : '/year')
}

export function findTier(platform: Platform, tierId: string | null): Tier | undefined {
  return tierId ? TIERS[platform].find(t => t.id === tierId) : undefined
}

export interface QuoteInput {
  platform: Platform
  currency: CurrencyCode
  studentCount: number
  tierId: string
  /** addon id → quantity (students for per-student add-ons, 1 for flat) */
  addons: Record<string, number>
}

export interface QuoteAddonLine {
  name: string
  note?: string
  perStudent: boolean
  quantity: number
  unitPrice: number
  cost: number
}

export interface Quote {
  tier: Tier
  studentCount: number
  tierPrice: number
  baseCost: number
  addonLines: QuoteAddonLine[]
  annual: number
  perStudent: number
  onboardingFee: number
  year1: number
}

export function calculateQuote(input: QuoteInput): Quote | null {
  const tier = findTier(input.platform, input.tierId)
  if (!tier) return null
  const studentCount = Math.max(MIN_STUDENTS, input.studentCount)
  const tierPrice = getPrice(tier.prices, input.currency)
  const baseCost = tierPrice * studentCount

  const addonLines: QuoteAddonLine[] = []
  for (const [addonId, quantity] of Object.entries(input.addons)) {
    const addon = tier.addons.find(a => a.id === addonId)
    if (!addon) continue
    const unitPrice = getPrice(addon.prices, input.currency)
    addonLines.push({
      name: addon.name,
      note: addon.note,
      perStudent: addon.perStudent,
      quantity,
      unitPrice,
      cost: addon.perStudent ? unitPrice * quantity : unitPrice,
    })
  }

  const annual = baseCost + addonLines.reduce((s, l) => s + l.cost, 0)
  const onboardingFee = getPrice(tier.onboarding.prices, input.currency)
  return {
    tier,
    studentCount,
    tierPrice,
    baseCost,
    addonLines,
    annual,
    perStudent: annual / studentCount,
    onboardingFee,
    year1: annual + onboardingFee,
  }
}

/** Plain-text summary for the Copy button — same format as the original Webflow calculator. */
export function quoteToText(q: Quote, input: QuoteInput): string {
  const m = (n: number) => formatMoney(n, input.currency)
  const sym = currencySymbol(input.currency)
  let text = `Orah Pricing Summary\n\n`
  text += `Currency: ${input.currency} (${currencyName(input.currency)})\n`
  text += `Platform: ${PLATFORM_LABELS[input.platform]}\n`
  text += `Students: ${q.studentCount}\n`
  text += `Tier: ${q.tier.name}\n\n`
  text += `Base Cost: ${q.studentCount} × ${sym}${q.tierPrice} = ${m(q.baseCost)}\n\n`
  if (q.addonLines.length > 0) {
    text += `Add-ons:\n`
    for (const l of q.addonLines) {
      const calc = l.perStudent ? `${l.quantity} students × ${sym}${l.unitPrice}` : m(l.unitPrice)
      text += `  - ${l.name}${l.note ? '*' : ''}: ${calc} = ${m(l.cost)}\n`
      if (l.note) text += `    *${l.note}\n`
    }
    text += `\n`
  }
  text += `Onboarding Fee (One-time): ${q.tier.onboarding.name} = ${m(q.onboardingFee)}\n\n`
  text += `Total Annual Cost: ${m(q.annual)}\n`
  text += `Per Student: ${sym}${q.perStudent.toFixed(2)}/year\n\n`
  text += `Total Year 1 Cost: ${m(q.year1)}\n`
  text += `(Includes one-time onboarding fee)`
  return text
}
