import type { Quote, QuoteInput } from '../pricing/calc'
import type { LineItem } from './calc'
import { briefAddonName, briefOnboardingName, briefTierName } from './config'

/** Calculator → brief one-time fees: onboarding first, then additional fees (qty = packs, unit price per pack). */
export function quoteToOneTimeFees(quote: Quote): LineItem[] {
  return [
    { product: briefOnboardingName(quote.tier.onboarding.name), qty: 1, unitPrice: quote.onboardingFee },
    ...quote.oneTimeLines.map(l => ({ product: l.name, qty: l.quantity, unitPrice: l.unitPrice })),
  ]
}

/** Calculator quote → brief line items (tier first, then add-ons in calculator order). */
export function quoteToLines(quote: Quote, input: QuoteInput): LineItem[] {
  return [
    {
      product: briefTierName(input.platform, quote.tier.id, quote.tier.name),
      qty: quote.studentCount,
      unitPrice: quote.tierPrice,
    },
    ...quote.addonLines.map(l => ({
      product: briefAddonName(l.name),
      qty: l.perStudent ? l.quantity : 1,
      unitPrice: l.unitPrice,
    })),
  ]
}
