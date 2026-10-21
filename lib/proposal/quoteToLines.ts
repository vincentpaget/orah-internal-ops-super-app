import type { Quote, QuoteInput } from '../pricing/calc'
import type { LineItem } from './calc'
import { briefAddonName, briefTierName } from './config'

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
