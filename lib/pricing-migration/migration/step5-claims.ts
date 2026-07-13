import type { Platform, Step5Result } from './types';
import type { SuperviseTier, BoardingTier } from '@/lib/pricing-migration/data/product-mapping';
import type { Quantities } from './types';
import { getNewAllowedClaims, SUNSETTING_CLAIMS } from '@/lib/pricing-migration/data/feature-claims';
import type { ActiveProducts } from '@/lib/pricing-migration/data/feature-claims';

export function analyzeClaimsGap(
  platform: Platform,
  tier: SuperviseTier | BoardingTier,
  quantities: Quantities,
  currentClaimsRaw: string | null
): Step5Result {
  const currentClaims = parseClaimsArray(currentClaimsRaw);

  const superviseTierSafe = platform === 'Supervise' && tier !== 'Requires Manual Review'
    ? (tier as 'Basic' | 'Pro' | 'Elite')
    : undefined;
  const boardingTierSafe = platform === 'Boarding' && tier !== 'Requires Manual Review'
    ? (tier as 'Core' | 'Pro')
    : undefined;

  const products: ActiveProducts = {
    superviseTier: superviseTierSafe,
    boardingTier: boardingTierSafe,
    hasNurtureAddon: quantities.nurtureAddonQuantity > 0,
    hasBoardingAddon: quantities.boardingAddonQuantity > 0,
    hasAutoAttendanceAddon: false, // not mapped in migration — not a current product
    hasDismissalsAddon: false,     // not mapped in migration — not a current product
    hasOpenApiAddon: false,        // Open API is tier-mapped, no separate add-on charge
  };

  const newAllowedClaims = getNewAllowedClaims(products);
  const gaps: string[] = [];
  const sunsetting: string[] = [];

  for (const claim of currentClaims) {
    if (SUNSETTING_CLAIMS.has(claim)) {
      sunsetting.push(claim);
      continue;
    }
    if (!newAllowedClaims.has(claim)) {
      gaps.push(claim);
    }
  }

  return {
    claimsGap: { gaps, sunsetting },
    newAllowedClaims: Array.from(newAllowedClaims),
    currentClaims,
  };
}

function parseClaimsArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
