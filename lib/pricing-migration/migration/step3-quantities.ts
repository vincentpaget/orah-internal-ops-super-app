import type { DBAccount, Platform, Step3Result, Quantities } from './types';

const MIN_STUDENTS = 250;

export function calculateQuantities(platform: Platform, account: DBAccount, noFloor = false): Step3Result {
  const notes: string[] = [];
  let superviseLicences = account.superviseLicences ?? 0;
  const nurtureLicences = account.nurtureLicences ?? 0;
  const floor = noFloor ? 0 : MIN_STUDENTS;

  // Nurture-only customers: use nurture licences as supervise proxy
  if (superviseLicences === 0 && nurtureLicences > 0) {
    notes.push(
      `Supervise_Licences is 0/null but Nurture_Licences = ${nurtureLicences} — using Nurture quantity as Supervise proxy (Nurture-only customer)`
    );
    superviseLicences = nurtureLicences;
  }

  let quantities: Quantities;

  if (platform === 'Supervise') {
    const platformLicences = Math.max(superviseLicences, nurtureLicences, floor);
    const nurtureAddonQuantity = nurtureLicences > 0 ? nurtureLicences : 0;

    let boardingAddonQuantity = 0;
    const useCase = account.superviseUseCase;
    if (useCase === 'Boarding Only' || useCase === 'Day & Boarding') {
      boardingAddonQuantity = superviseLicences;
      notes.push(
        `Boarding add-on quantity = ${superviseLicences} (Supervise_Licences proxy for boarders; use-case: "${useCase}")`
      );
    }

    if (!noFloor && platformLicences === MIN_STUDENTS && superviseLicences < MIN_STUDENTS) {
      notes.push(`Platform licences floored to minimum of ${MIN_STUDENTS} students`);
    }

    quantities = { platformLicences, nurtureAddonQuantity, boardingAddonQuantity };
  } else {
    // Boarding platform
    const platformLicences = Math.max(superviseLicences, floor);
    const nurtureAddonQuantity = Math.max(0, nurtureLicences - superviseLicences);

    if (!noFloor && platformLicences === MIN_STUDENTS && superviseLicences < MIN_STUDENTS) {
      notes.push(`Platform licences floored to minimum of ${MIN_STUDENTS} boarders`);
    }
    if (nurtureAddonQuantity > 0) {
      notes.push(
        `Nurture add-on quantity = ${nurtureAddonQuantity} (Nurture_Licences ${nurtureLicences} minus Platform_Licences ${superviseLicences})`
      );
    }

    quantities = { platformLicences, nurtureAddonQuantity, boardingAddonQuantity: 0 };
  }

  return { quantities, notes };
}
