import type { Platform, RenewalOpportunity, Step6Result } from './types';
import type { Step2Result, Step5Result } from './types';
import type { DBAccount } from './types';

export function determineOutcome(
  platform: Platform,
  account: DBAccount,
  opp: RenewalOpportunity,
  newListPrice: number,
  step2: Step2Result,
  step5: Step5Result,
  multipleDbAccounts: boolean
): Step6Result {
  const notes: string[] = [];

  // Comparison baseline
  const comparisonBaseline =
    opp.autoRenewalAmount != null
      ? opp.autoRenewalAmount
      : (opp.arrBasis ?? account.localArr ?? 0) * 1.07;

  if (opp.autoRenewalAmount == null) {
    notes.push('Auto_Renewal_Amount__c not set — baseline calculated as ARR × 1.07');
  }

  const delta = newListPrice - comparisonBaseline;

  const reviewReasons: string[] = [];

  if (delta < 0) {
    reviewReasons.push(
      `New model list price (${newListPrice.toFixed(2)}) is lower than the auto-renewal baseline (${comparisonBaseline.toFixed(2)}) — verify mapping is correct`
    );
  }

  const rollsL90d = account.attendanceRollsScheduledL90d ?? 0;
  const effectiveGaps = step5.claimsGap.gaps.filter(
    gap => !(gap === 'scheduled_rolls' && rollsL90d === 0)
  );

  if (step5.claimsGap.gaps.includes('scheduled_rolls') && rollsL90d === 0) {
    notes.push(
      'scheduled_rolls claim gap ignored — Attendance_Rolls_Scheduled_L90d is 0, feature is not actively in use'
    );
  }

  if (effectiveGaps.length > 0) {
    reviewReasons.push(
      `Customer would lose access to ${effectiveGaps.length} feature(s): ${effectiveGaps.join(', ')}`
    );
  }

  if (multipleDbAccounts) {
    reviewReasons.push(
      'Multiple DB Accounts on this opportunity — migration must be run per DB Account and totals rolled up'
    );
  }

  if (step2.hasManualReview) {
    reviewReasons.push(
      'One or more transactions contain "Custom Subscription Fee" — cannot be automatically mapped'
    );
  }

  if (platform === 'Supervise' && account.superviseUseCase === 'Day & Boarding') {
    reviewReasons.push(
      'Day & Boarding use-case: boarding add-on quantity defaults to total Supervise_Licences as a proxy — confirm actual boarder count before finalising'
    );
  }

  if (step5.claimsGap.sunsetting.length > 0) {
    notes.push(
      `Sunsetting claims present (not treated as gaps): ${step5.claimsGap.sunsetting.join(', ')}`
    );
  }

  const status = reviewReasons.length === 0 ? 'Pass' : 'Needs Review';
  notes.push(...reviewReasons);

  return { status, delta, comparisonBaseline, notes };
}
