import type { Platform, Quantities, Step4Result } from './types';
import type { SuperviseTier, BoardingTier } from '@/lib/pricing-migration/data/product-mapping';
import { SUPERVISE_TIER_PRICES, BOARDING_TIER_PRICES, ADDON_PRICES } from '@/lib/pricing-migration/data/pricelist';
import type { Currency } from '@/lib/pricing-migration/data/pricelist';

export function calculateListPrice(
  platform: Platform,
  tier: SuperviseTier | BoardingTier,
  quantities: Quantities,
  currency: string
): Step4Result {
  const ccy = (currency as Currency) in SUPERVISE_TIER_PRICES.Basic
    ? (currency as Currency)
    : 'USD';

  let platformCost = 0;
  let nurtureAddonCost = 0;
  let boardingAddonCost = 0;

  if (platform === 'Supervise') {
    const superviseTier = tier as SuperviseTier;
    if (superviseTier === 'Requires Manual Review') {
      return {
        priceBreakdown: { platformCost: 0, nurtureAddonCost: 0, boardingAddonCost: 0, total: 0 },
        currency: ccy,
      };
    }
    const tierPrice = SUPERVISE_TIER_PRICES[superviseTier][ccy];
    platformCost = quantities.platformLicences * tierPrice;

    if (quantities.nurtureAddonQuantity > 0) {
      nurtureAddonCost = quantities.nurtureAddonQuantity * ADDON_PRICES.Nurture[ccy];
    }
    if (quantities.boardingAddonQuantity > 0) {
      boardingAddonCost = quantities.boardingAddonQuantity * ADDON_PRICES.Boarding[ccy];
    }
  } else {
    // Boarding platform
    const boardingTier = tier as BoardingTier;
    if (boardingTier === 'Requires Manual Review') {
      return {
        priceBreakdown: { platformCost: 0, nurtureAddonCost: 0, boardingAddonCost: 0, total: 0 },
        currency: ccy,
      };
    }
    const tierPrice = BOARDING_TIER_PRICES[boardingTier][ccy];
    platformCost = quantities.platformLicences * tierPrice;

    // Nurture is included in Boarding Pro — only charge add-on for Core
    if (quantities.nurtureAddonQuantity > 0 && boardingTier === 'Core') {
      nurtureAddonCost = quantities.nurtureAddonQuantity * ADDON_PRICES.Nurture[ccy];
    }
  }

  const total = platformCost + nurtureAddonCost + boardingAddonCost;
  return {
    priceBreakdown: { platformCost, nurtureAddonCost, boardingAddonCost, total },
    currency: ccy,
  };
}
