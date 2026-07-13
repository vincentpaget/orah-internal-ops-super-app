import type { Platform, Step2Result } from './types';
import type { SuperviseTier, BoardingTier } from '@/lib/pricing-migration/data/product-mapping';
import {
  PRODUCT_TIER_MAP,
  SUPERVISE_TIER_RANK,
  BOARDING_TIER_RANK,
} from '@/lib/pricing-migration/data/product-mapping';
import type { Transaction } from './types';

export function mapToTier(platform: Platform, transactions: Transaction[]): Step2Result {
  const mapping: { productName: string; tier: string }[] = [];
  let hasManualReview = false;

  if (platform === 'Supervise') {
    let highestTier: SuperviseTier = 'Basic';

    for (const tx of transactions) {
      const name = tx.itemName;
      const entry = PRODUCT_TIER_MAP[name];
      const tier: SuperviseTier = entry?.superviseTier ?? 'Basic';

      if (!entry) {
        mapping.push({ productName: name, tier: 'Unknown (defaulting to Basic)' });
        continue;
      }
      if (tier === 'Requires Manual Review') hasManualReview = true;

      mapping.push({ productName: name, tier });

      if (SUPERVISE_TIER_RANK[tier] > SUPERVISE_TIER_RANK[highestTier]) {
        highestTier = tier;
      }
    }

    return { tier: highestTier, productTierMapping: mapping, hasManualReview };
  } else {
    let highestTier: BoardingTier = 'Core';

    for (const tx of transactions) {
      const name = tx.itemName;
      const entry = PRODUCT_TIER_MAP[name];
      const tier: BoardingTier = entry?.boardingTier ?? 'Core';

      if (!entry) {
        mapping.push({ productName: name, tier: 'Unknown (defaulting to Core)' });
        continue;
      }
      if (tier === 'Requires Manual Review') hasManualReview = true;

      mapping.push({ productName: name, tier });

      if (BOARDING_TIER_RANK[tier] > BOARDING_TIER_RANK[highestTier]) {
        highestTier = tier;
      }
    }

    return { tier: highestTier, productTierMapping: mapping, hasManualReview };
  }
}
