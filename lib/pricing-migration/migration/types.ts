import type { SuperviseTier, BoardingTier } from '@/lib/pricing-migration/data/product-mapping';

export type Platform = 'Supervise' | 'Boarding';
export type MigrationStatus = 'Pass' | 'Needs Review';

export interface DBAccount {
  id: string;
  analyticsGroupId: string;
  superviseLicences: number | null;
  nurtureLicences: number | null;
  superviseUseCase: 'Day Only' | 'Boarding Only' | 'Day & Boarding' | null;
  attendanceRollsScheduledL90d: number | null;
  allowedClaimsArray: string | null; // JSON string
  localArr: number | null;
  homeArr: number | null;
  localCarr: number | null;
  homeCarr: number | null;
  activeStudentProfiles: number | null;
}

export interface RenewalOpportunity {
  id: string;
  name: string;
  contractStartDate: string | null;
  closeDate: string | null;
  stageName: string | null;
  type: string | null;
  ownerId: string;
  pricebook2Id: string | null;
  autoRenewalAmount: number | null;
  currencyIsoCode: string;
  arrBasis: number | null;
  bookedArr: number | null;
  netArr: number | null;
  managedAccounts: number | null;
  doNotAutoRenew: boolean | null;
  orderNotes: string | null;
  renewalProductsConfirmed: boolean | null;
}

export interface Transaction {
  id: string;
  currencyCode: string;
  itemName: string;
  itemCode: string;
  localArr: number | null;
  studentProfiles: number | null;
  dbAccountId: string;
  dbAccountExtId: string | null;
}

export interface Quantities {
  platformLicences: number;
  nurtureAddonQuantity: number;
  boardingAddonQuantity: number;
}

export interface PriceBreakdown {
  platformCost: number;
  nurtureAddonCost: number;
  boardingAddonCost: number;
  total: number;
}

export interface ClaimsGapResult {
  gaps: string[];        // claim codes lost under new model
  sunsetting: string[];  // sunsetting claims in current set
}

export interface Step1Result {
  platform: Platform;
  reason: string;
  conditions: {
    scheduledRollsInClaims: boolean;
    attendanceRollsL90d: number;
    superviseUseCase: string | null;
    ruleApplied: 1 | 2 | 3;
  };
}

export interface Step2Result {
  tier: SuperviseTier | BoardingTier;
  productTierMapping: { productName: string; tier: string }[];
  hasManualReview: boolean;
}

export interface Step3Result {
  quantities: Quantities;
  notes: string[];
}

export interface Step4Result {
  priceBreakdown: PriceBreakdown;
  currency: string;
}

export interface Step5Result {
  claimsGap: ClaimsGapResult;
  newAllowedClaims: string[];
  currentClaims: string[];
}

export interface Step6Result {
  status: MigrationStatus;
  delta: number;
  comparisonBaseline: number;
  notes: string[];
}

export interface RawTransactionInput {
  productName: string;
  productCode: string;
  quantity: number | null;
  currency: string;
  localArr: number | null;
}

export interface RawInputs {
  superviseLicences: number | null;
  nurtureLicences: number | null;
  activeStudentProfiles: number | null;
  attendanceRollsL90d: number | null;
  superviseUseCase: string | null;
  localArr: number | null;
  transactions: RawTransactionInput[];
}

export interface MigrationResult {
  opportunityId: string;
  opportunityName: string;
  stageName: string | null;
  type: string | null;
  renewalDate: string | null;
  closeDate: string | null;
  currency: string;
  arrBasis: number | null;
  bookedArr: number | null;
  netArr: number | null;
  managedAccounts: number | null;
  autoRenewalAmount: number | null;
  dbAccountId: string;
  dbAccountExtId: string;
  multipleDbAccounts: boolean;
  doNotAutoRenew: boolean | null;
  orderNotes: string | null;
  renewalProductsConfirmed: boolean | null;
  rawInputs: RawInputs;
  step1: Step1Result;
  step2: Step2Result;
  step3: Step3Result;
  step4: Step4Result;
  step5: Step5Result;
  step6: Step6Result;
}
