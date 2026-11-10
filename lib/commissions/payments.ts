import type { DealEdit, SFCommissionOpportunity } from './types'

/**
 * Partial payments: the SF Commission Paid Amount is a running total of what's been paid on a deal
 * (e.g. 50% when the prorated first invoice clears, the rest once the first annual invoice is paid).
 * What's still owed is Commission Amount − Paid Amount, which reaches 0 once the deal is fully paid.
 * Ticking "Commission Paid" closes the deal regardless of any leftover difference.
 */

type Edits = Record<string, DealEdit>

function pick<K extends keyof DealEdit>(edits: Edits | undefined, id: string, key: K): DealEdit[K] | undefined {
  return edits?.[id]?.[key]
}

export function effectiveCommissionAmount(deal: SFCommissionOpportunity, edits?: Edits): number | null {
  const e = pick(edits, deal.Id, 'commissionAmount')
  return e !== undefined ? e : deal.Commission_Amount_NZD__c
}

export function effectivePaidAmount(deal: SFCommissionOpportunity, edits?: Edits): number | null {
  const e = pick(edits, deal.Id, 'commissionPaidAmount')
  return e !== undefined ? e : deal.Commission_Paid_Amount_NZD__c
}

export function effectivePaidFlag(deal: SFCommissionOpportunity, edits?: Edits): boolean {
  const e = pick(edits, deal.Id, 'commissionPaid')
  return (e !== undefined ? e : deal.Commission_Paid__c) ?? false
}

/** Onboarding commission is always the app's calculated amount (fee × the rep's onboarding rate) — never stored in SF. */
export function onboardingCommissionAmount(deal: SFCommissionOpportunity): number {
  return deal.calculatedOnboardingCommission ?? 0
}

/** All-or-nothing: the onboarding commission counts as paid once a paid amount has been recorded. */
export function isOnboardingCommissionPaid(deal: SFCommissionOpportunity, edits?: Edits): boolean {
  return (effectiveOnboardingPaidAmount(deal, edits) ?? 0) !== 0
}

export function effectiveOnboardingPaidDate(deal: SFCommissionOpportunity, edits?: Edits): string | null {
  const e = pick(edits, deal.Id, 'onboardingCommissionPaidDate')
  return e !== undefined ? e : deal.Onboarding_Commission_Paid_Date__c
}

export function effectiveOnboardingPaidAmount(deal: SFCommissionOpportunity, edits?: Edits): number | null {
  const e = pick(edits, deal.Id, 'onboardingCommissionPaidAmount')
  return e !== undefined ? e : deal.Onboarding_Commission_Paid_Amount_NZD__c
}

/** Rounds float dust to 0 but keeps negatives — a clawback (e.g. a contract reset) is a negative amount owed. */
const clampOwed = (n: number) => (Math.abs(n) > 0.005 ? n : 0)

/** ARR commission still owed: 0 once "Commission Paid" is ticked, otherwise Amount − Paid to date (negative for clawbacks). */
export function remainingCommission(deal: SFCommissionOpportunity, edits?: Edits): number {
  if (effectivePaidFlag(deal, edits)) return 0
  return clampOwed((effectiveCommissionAmount(deal, edits) ?? 0) - (effectivePaidAmount(deal, edits) ?? 0))
}

/** Onboarding / PS commission still owed: the calculated commission, or 0 once a payout has been recorded. */
export function remainingOnboardingCommission(deal: SFCommissionOpportunity, edits?: Edits): number {
  return isOnboardingCommissionPaid(deal, edits) ? 0 : clampOwed(onboardingCommissionAmount(deal))
}

/** Something has been paid but the deal isn't closed out yet. */
export function isPartiallyPaid(deal: SFCommissionOpportunity, edits?: Edits): boolean {
  return !effectivePaidFlag(deal, edits) && (effectivePaidAmount(deal, edits) ?? 0) !== 0 && remainingCommission(deal, edits) !== 0
}

/**
 * The deal's commission amount is fixed (per the comp plan, once the first invoice is paid) — either it's
 * fully paid, or a partial payment has already gone out against it. Locked deals keep their SF amount.
 */
export function isCommissionLocked(deal: SFCommissionOpportunity): boolean {
  return deal.Commission_Paid__c === true || (deal.Commission_Paid_Amount_NZD__c ?? 0) !== 0
}

/* ── Earned vs pending (comp plan §4: commission is released in proportion to the committed ARR invoiced and paid) ── */

/** Whether paid amounts come from the deal's Maxio invoice lines, or are estimated from opportunity totals. */
export function paidSource(deal: SFCommissionOpportunity): 'maxio' | 'estimate' {
  return deal.maxioInvoices ? 'maxio' : 'estimate'
}

/**
 * ARR invoiced and paid, in the deal's local currency: the subscription lines on the deal's Maxio invoices that
 * are Paid (e.g. Westover: $3,000 Supervise + $500 Boarding on MX-11122 = $3,500). Onboarding, SMS credits and
 * hardware lines are never counted.
 *
 * Estimate when the deal has no linked Maxio lines: Total Invoice Amount Paid minus the onboarding fee, which
 * assumes the fee was billed and paid on the first invoice and nothing else one-off was invoiced.
 */
export function arrInvoicedPaid(deal: SFCommissionOpportunity): number {
  if (deal.maxioInvoices) return deal.maxioInvoices.arrPaid
  return Math.max(0, (deal.Total_Invoice_Amount_Paid__c ?? 0) - (deal.onboardingFeeAmount ?? 0))
}

/**
 * Share of the deal's commission that's been earned so far (0–1): ARR invoiced and paid ÷ committed ARR, capped
 * at 100%. With Maxio lines this is exact, and overrides the SF payout threshold (whose paid total includes the
 * onboarding fee). Without them, a met payout threshold still counts as fully earned.
 * Clawbacks (negative ARR) are all-or-nothing on the payout threshold.
 */
export function earnedShare(deal: SFCommissionOpportunity): number {
  const carr = deal.Net_ARR_Override__c ?? 0
  if (carr <= 0) return deal.Commission_Payout_Threshold_Met__c ? 1 : 0
  if (!deal.maxioInvoices && deal.Commission_Payout_Threshold_Met__c) return 1
  return Math.min(1, arrInvoicedPaid(deal) / carr)
}

/** Commission earned to date (NZD): Commission Amount × earned share. */
export function earnedCommission(deal: SFCommissionOpportunity, edits?: Edits): number {
  return (effectiveCommissionAmount(deal, edits) ?? 0) * earnedShare(deal)
}

/** ARR commission payable in the next pay run: earned to date − paid to date (never below 0 on a positive deal). */
export function payableNow(deal: SFCommissionOpportunity, edits?: Edits): number {
  if (effectivePaidFlag(deal, edits)) return 0
  const due = clampOwed(earnedCommission(deal, edits) - (effectivePaidAmount(deal, edits) ?? 0))
  return (effectiveCommissionAmount(deal, edits) ?? 0) >= 0 ? Math.max(0, due) : due
}

/** ARR commission not yet earned (still waiting on invoices): remaining − payable now. */
export function pendingNow(deal: SFCommissionOpportunity, edits?: Edits): number {
  return clampOwed(remainingCommission(deal, edits) - payableNow(deal, edits))
}

/**
 * The onboarding fee is earned once it's paid in full: every PS_ line on the deal's Maxio invoices is on a Paid
 * invoice. Estimate without Maxio lines: invoices paid cover at least the fee (or the payout threshold is met).
 */
export function onboardingFeePaid(deal: SFCommissionOpportunity): boolean {
  if (deal.maxioInvoices) {
    const { onboardingInvoiced, onboardingPaid } = deal.maxioInvoices
    return onboardingInvoiced > 0 && onboardingPaid >= onboardingInvoiced - 0.01
  }
  if (deal.Commission_Payout_Threshold_Met__c) return true
  return (deal.onboardingFeeAmount ?? 0) > 0 && (deal.Total_Invoice_Amount_Paid__c ?? 0) >= deal.onboardingFeeAmount - 0.01
}

/**
 * Onboarding / PS fee actually paid, in the deal's local currency: the PS_ lines on the deal's Paid Maxio invoices
 * (same method as `arrInvoicedPaid`). Estimate without Maxio lines: the whole fee once invoices paid cover it.
 */
export function onboardingInvoicedPaid(deal: SFCommissionOpportunity): number {
  if (deal.maxioInvoices) return deal.maxioInvoices.onboardingPaid
  return onboardingFeePaid(deal) ? (deal.onboardingFeeAmount ?? 0) : 0
}

/**
 * Onboarding commission is all-or-nothing (§5.2: earned once the fee has been paid in full): 1 once every PS_
 * line on the deal's Maxio invoices is Paid (or, without Maxio lines, on the estimate), otherwise 0.
 */
export function onboardingEarnedShare(deal: SFCommissionOpportunity): number {
  return onboardingFeePaid(deal) ? 1 : 0
}

/** Onboarding commission payable now: the customer has paid the fee in full, but the commission isn't paid yet. */
export function onboardingPayableNow(deal: SFCommissionOpportunity, edits?: Edits): number {
  return onboardingFeePaid(deal) ? Math.max(0, remainingOnboardingCommission(deal, edits)) : 0
}

/** Onboarding commission pending: still awaiting the customer's payment of the fee. */
export function onboardingPendingNow(deal: SFCommissionOpportunity, edits?: Edits): number {
  return onboardingFeePaid(deal) ? 0 : remainingOnboardingCommission(deal, edits)
}

/** Everything going into the next pay run for this deal: ARR payable now + onboarding payable now. */
export function totalPayableNow(deal: SFCommissionOpportunity, edits?: Edits): number {
  return payableNow(deal, edits) + onboardingPayableNow(deal, edits)
}

const today = () => new Date().toISOString().slice(0, 10)
const cents = (n: number) => Math.round(n * 100) / 100

/**
 * The edits that record paying out the ARR commission payable now: Paid to Date moves up to the amount earned, the
 * paid date defaults to today, and "Commission Fully Paid" ticks once nothing is left. Review, then Sync to save.
 */
export function recordArrPaymentEdits(deal: SFCommissionOpportunity, edits?: Edits): DealEdit {
  const paidAfter = (effectivePaidAmount(deal, edits) ?? 0) + payableNow(deal, edits)
  const amount = effectiveCommissionAmount(deal, edits) ?? 0
  return {
    commissionPaidAmount: cents(paidAfter),
    commissionPaidDate: today(),
    commissionPaid: Math.abs(amount - paidAfter) <= 0.005,
  }
}

/** The edits that record paying out the onboarding commission in full: the calculated amount and today's date. */
export function recordOnboardingPaymentEdits(deal: SFCommissionOpportunity, edits?: Edits): DealEdit {
  return {
    onboardingCommissionPaidAmount: cents(onboardingPayableNow(deal, edits)),
    onboardingCommissionPaidDate: today(),
  }
}

/** Both at once (Payable Summary): ARR always, onboarding only when there's onboarding commission payable now. */
export function recordPaymentEdits(deal: SFCommissionOpportunity, edits?: Edits, includeOnboarding = false): DealEdit {
  const result: DealEdit = payableNow(deal, edits) !== 0 ? recordArrPaymentEdits(deal, edits) : {}
  if (includeOnboarding && onboardingPayableNow(deal, edits) !== 0) Object.assign(result, recordOnboardingPaymentEdits(deal, edits))
  return result
}
