import type { DBAccount, Step1Result } from './types';

export function determinePlatform(account: DBAccount): Step1Result {
  const claims = parseClaimsArray(account.allowedClaimsArray);
  const hasScheduledRolls = claims.includes('scheduled_rolls');
  const rollsL90d = account.attendanceRollsScheduledL90d ?? 0;

  if (hasScheduledRolls && rollsL90d > 0) {
    return {
      platform: 'Supervise',
      reason: `scheduled_rolls claim is active and ${rollsL90d} attendance rolls were scheduled in the last 90 days`,
      conditions: { scheduledRollsInClaims: true, attendanceRollsL90d: rollsL90d, superviseUseCase: account.superviseUseCase, ruleApplied: 1 },
    };
  }

  if (account.superviseUseCase === 'Boarding Only') {
    return {
      platform: 'Boarding',
      reason: hasScheduledRolls
        ? `scheduled_rolls claim present but Attendance_Rolls_Scheduled_L90d = 0 (not actively used); Supervise_Use_Case is "Boarding Only"`
        : `Supervise_Use_Case is "Boarding Only" and scheduled_rolls is not in active use`,
      conditions: { scheduledRollsInClaims: hasScheduledRolls, attendanceRollsL90d: rollsL90d, superviseUseCase: account.superviseUseCase, ruleApplied: 2 },
    };
  }

  return {
    platform: 'Supervise',
    reason: account.superviseUseCase
      ? `Default: use-case is "${account.superviseUseCase}" — falls through to Supervise`
      : 'Default: no boarding-only use-case or active scheduled rolls',
    conditions: { scheduledRollsInClaims: hasScheduledRolls, attendanceRollsL90d: rollsL90d, superviseUseCase: account.superviseUseCase, ruleApplied: 3 },
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
