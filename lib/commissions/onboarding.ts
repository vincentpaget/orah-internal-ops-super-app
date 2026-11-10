/** Client-safe constants for onboarding / professional service fee commission (comp plan §5.2). */

/** Product family holding onboarding + professional service fees. SMS credits are PAYG, hardware is Hardware — neither counts. */
export const ONBOARDING_PRODUCT_FAMILY = 'Professional Services'

/**
 * Onboarding commission starts with the BDM Schedule 2.0 effective date. Deals closed earlier never earn it, so
 * the Payable query doesn't look further back for onboarding payouts.
 */
export const ONBOARDING_COMMISSION_START = '2026-10-01'

/**
 * Fields an admin adds to Opportunity to record onboarding commission payouts. The commission amount itself isn't
 * stored — the app calculates it from the fee and the rep's onboarding rate.
 */
export const ONBOARDING_SF_FIELD_NAMES = [
  'Onboarding_Commission_Paid_Amount_NZD__c',
  'Onboarding_Commission_Paid_Date__c',
] as const
