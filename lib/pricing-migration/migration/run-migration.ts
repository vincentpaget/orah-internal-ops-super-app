import type { DBAccount, RenewalOpportunity, Transaction, MigrationResult, RawInputs } from './types';
import { determinePlatform } from './step1-platform';
import { mapToTier } from './step2-tier';
import { calculateQuantities } from './step3-quantities';
import { calculateListPrice } from './step4-price';
import { analyzeClaimsGap } from './step5-claims';
import { determineOutcome } from './step6-outcome';

export function runMigration(
  account: DBAccount,
  opp: RenewalOpportunity,
  transactions: Transaction[],
  multipleDbAccounts: boolean
): MigrationResult {
  // Derive localArr from transaction sum if the DB Account field is null
  const txArrSum = transactions.reduce((sum, tx) => sum + (tx.localArr ?? 0), 0);
  const effectiveAccount: DBAccount = account.localArr == null && txArrSum > 0
    ? { ...account, localArr: txArrSum }
    : account;

  const step1 = determinePlatform(effectiveAccount);
  const step2 = mapToTier(step1.platform, transactions);
  const step3 = calculateQuantities(step1.platform, effectiveAccount);
  const step4 = calculateListPrice(step1.platform, step2.tier, step3.quantities, opp.currencyIsoCode);
  const step5 = analyzeClaimsGap(step1.platform, step2.tier, step3.quantities, effectiveAccount.allowedClaimsArray);
  const step6 = determineOutcome(step1.platform, effectiveAccount, opp, step4.priceBreakdown.total, step2, step5, multipleDbAccounts);

  const rawInputs: RawInputs = {
    superviseLicences: effectiveAccount.superviseLicences,
    nurtureLicences: effectiveAccount.nurtureLicences,
    activeStudentProfiles: effectiveAccount.activeStudentProfiles,
    attendanceRollsL90d: effectiveAccount.attendanceRollsScheduledL90d,
    superviseUseCase: effectiveAccount.superviseUseCase,
    localArr: effectiveAccount.localArr,
    transactions: transactions.map(tx => ({
      productName: tx.itemName,
      productCode: tx.itemCode,
      quantity: tx.studentProfiles,
      currency: tx.currencyCode,
      localArr: tx.localArr,
    })),
  };

  return {
    opportunityId: opp.id,
    opportunityName: opp.name,
    stageName: opp.stageName,
    type: opp.type,
    renewalDate: opp.contractStartDate,
    closeDate: opp.closeDate,
    currency: opp.currencyIsoCode,
    arrBasis: opp.arrBasis,
    bookedArr: opp.bookedArr,
    netArr: opp.netArr,
    managedAccounts: opp.managedAccounts,
    autoRenewalAmount: opp.autoRenewalAmount,
    dbAccountId: account.id,
    dbAccountExtId: account.analyticsGroupId,
    multipleDbAccounts,
    doNotAutoRenew: opp.doNotAutoRenew,
    orderNotes: opp.orderNotes,
    renewalProductsConfirmed: opp.renewalProductsConfirmed,
    rawInputs,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
  };
}
