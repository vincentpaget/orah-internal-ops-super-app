// Configuration for the proposal offer builder. Policy limits live here so the
// full Discount & Terms rules can be added later without touching the UI.

import type { CurrencyCode, Platform } from '../pricing/data'

export type OfferType = 'standard' | 'funded'

export const DISCOUNT_POLICY_URL = 'https://app.notion.com/p/3fb6511f93c781f4a4acd9aa8e628ad4'

export const DISCOUNT_POLICY = {
  approvers: 'Vinni or Paul',
  /** Subscription discount above this (per offer) needs approval. */
  subscriptionMaxPct: 30,
  /** Onboarding discount above this needs approval. */
  onboardingMaxPct: 50,
}

export const OFFER_LABELS: Record<OfferType, { name: string; tagline: string }> = {
  standard: { name: 'Standard', tagline: 'Get Started Now, Save Ongoing' },
  funded: { name: 'Special Funded Offer Program', tagline: 'Set Up Now, Pay Later' },
}

/** Currency symbols used in the brief (unambiguous, unlike the calculator's "$" for AUD/NZD/CAD). */
export const BRIEF_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  GBP: '£',
  EUR: '€',
}

/** Product names as they appear in proposals. Tiers keyed by `platform:tierId`, add-ons by calculator name. */
export const BRIEF_TIER_NAMES: Record<string, string> = {
  'supervise:basic': 'Supervise 1 (Basic)',
  'supervise:pro': 'Supervise 2 (Pro)',
  'supervise:elite': 'Supervise 3 (Elite)',
  'boarding:core': 'Boarding Core',
  'boarding:pro': 'Boarding Pro',
}

export const BRIEF_ADDON_NAMES: Record<string, string> = {
  Boarding: 'Boarding Add-On',
}

export function briefTierName(platform: Platform, tierId: string, fallback: string): string {
  return BRIEF_TIER_NAMES[`${platform}:${tierId}`] ?? fallback
}

export function briefAddonName(name: string): string {
  return BRIEF_ADDON_NAMES[name] ?? name
}

// ── Policy check ────────────────────────────────────────────────────────────

export type ApprovalStatus = 'within_policy' | 'needs_approval'

export interface PolicyInput {
  offers: { type: OfferType; discountPct: number; onboardingDiscountPct: number }[]
}

export interface PolicyResult {
  status: ApprovalStatus
  /** Human-readable list of what needs approval. */
  items: string[]
}

export function checkPolicy(input: PolicyInput): PolicyResult {
  const items: string[] = []
  for (const o of input.offers) {
    const name = OFFER_LABELS[o.type].name
    if (o.discountPct > DISCOUNT_POLICY.subscriptionMaxPct) {
      items.push(`${name} subscription discount ${o.discountPct}% is above ${DISCOUNT_POLICY.subscriptionMaxPct}%`)
    }
    if (o.onboardingDiscountPct > DISCOUNT_POLICY.onboardingMaxPct) {
      items.push(`${name} onboarding discount ${o.onboardingDiscountPct}% is above ${DISCOUNT_POLICY.onboardingMaxPct}%`)
    }
  }
  return { status: items.length > 0 ? 'needs_approval' : 'within_policy', items }
}
