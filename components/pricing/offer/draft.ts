import type { ProposalOpp } from '@/app/api/pricing/opportunities/route'
import type { OfferType } from '@/lib/proposal/config'
import { addDays, firstOfNextMonth } from '@/lib/proposal/dates'
import type { ParsedDetails } from '@/lib/proposal/parseBrief'

/** Default proposal validity; the policy maximum is EXPIRY_MAX_DAYS. */
export const EXPIRY_DEFAULT_DAYS = 7

/** Everything typed into the offer builder. Held by the calculator so it survives going back and forth. */
export interface OfferDraft {
  // Step 2 — opportunity
  opp: ProposalOpp | null
  schoolName: string
  contactName: string
  contactTitle: string
  sis: string
  repName: string
  repEmail: string
  // Step 3 — deal details
  proposalDate: string
  expiryDate: string
  syMonth: number
  termYears: number
  /** Always the 1st of a month: the date picker snaps whatever day is picked back to the 1st. */
  startDate: string
  // Step 4 — offers
  include: Record<OfferType, boolean>
  recommended: OfferType
  // Step 5 — discounts
  discount: Record<OfferType, string>
  /** One discount per offer for all one-time fees (onboarding + any others) */
  oneTimeDiscount: Record<OfferType, string>
  // Step 6 — rollout
  kickoff: string
  setupWindow: string
  trainingWindow: string
  notes: string
  /** null = follow the expiry date */
  signBy: string | null
  /** null = follow the default */
  goLive: string | null
}

export function emptyDraft(today: string): OfferDraft {
  return {
    opp: null,
    schoolName: '',
    contactName: '',
    contactTitle: '',
    sis: '',
    repName: '',
    repEmail: '',
    proposalDate: today,
    expiryDate: addDays(today, EXPIRY_DEFAULT_DAYS),
    syMonth: 7,
    termYears: 2,
    startDate: firstOfNextMonth(today),
    include: { standard: true, funded: false },
    recommended: 'funded',
    discount: { standard: '0', funded: '0' },
    oneTimeDiscount: { standard: '0', funded: '0' },
    kickoff: '',
    setupWindow: '',
    trainingWindow: '',
    notes: '',
    signBy: null,
    goLive: null,
  }
}

/** A loaded brief → a draft dated today (a revision is a new offer). */
export function draftFromBrief(d: ParsedDetails, today: string): OfferDraft {
  return {
    ...emptyDraft(today),
    opp: d.opportunityId
      ? {
        id: d.opportunityId,
        name: d.opportunityName,
        stage: '',
        closeDate: '',
        ownerName: d.repName,
        ownerEmail: d.repEmail,
        accountName: d.schoolName,
        sis: d.sis || null,
        numberInSchool: null,
        contact: d.contactName ? { name: d.contactName, title: d.contactTitle || null, email: null } : null,
      }
      : null,
    schoolName: d.schoolName,
    contactName: d.contactName,
    contactTitle: d.contactTitle,
    sis: d.sis,
    repName: d.repName,
    repEmail: d.repEmail,
    syMonth: d.schoolYearMonth,
    termYears: d.termYears,
    startDate: d.startDate || firstOfNextMonth(today),
    include: d.include,
    recommended: d.recommended,
    discount: { standard: String(d.discountPct.standard), funded: String(d.discountPct.funded) },
    oneTimeDiscount: { standard: String(d.oneTimeDiscountPct.standard), funded: String(d.oneTimeDiscountPct.funded) },
    kickoff: d.kickoffDate,
    setupWindow: d.setupWindow,
    trainingWindow: d.trainingWindow,
    notes: d.notes,
    signBy: d.signByDate,
    goLive: d.goLiveDate,
  }
}
