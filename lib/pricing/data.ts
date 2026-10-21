// Single source of truth for Orah list pricing, shared by the Pricing overview and calculator.
// Ported from the Webflow "pricing-internal" and "pricing-calculator" embeds.

export type CurrencyCode = 'USD' | 'GBP' | 'AUD' | 'NZD' | 'EUR' | 'CAD'
export type Prices = Record<CurrencyCode, number>
export type Platform = 'supervise' | 'boarding'

export interface Currency {
  code: CurrencyCode
  symbol: string
  name: string
  flag: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar', flag: '🇨🇦' },
]

export const PLATFORM_LABELS: Record<Platform, string> = {
  supervise: 'Supervise',
  boarding: 'Boarding',
}

// ── Price points ────────────────────────────────────────────────────────────

const P = {
  basic:         { USD: 5,    GBP: 4,    AUD: 7,    NZD: 8,    EUR: 4,    CAD: 7 },
  pro:           { USD: 23,   GBP: 17,   AUD: 32,   NZD: 38,   EUR: 19,   CAD: 31 },
  elite:         { USD: 30,   GBP: 23,   AUD: 42,   NZD: 50,   EUR: 25,   CAD: 41 },
  boardingCore:  { USD: 18,   GBP: 14,   AUD: 25,   NZD: 30,   EUR: 15,   CAD: 24 },
  boardingPro:   { USD: 33,   GBP: 25,   AUD: 46,   NZD: 54,   EUR: 28,   CAD: 45 },
  boardingAddon: { USD: 5,    GBP: 4,    AUD: 7,    NZD: 8,    EUR: 4,    CAD: 7 },
  perStudent6:   { USD: 6,    GBP: 5,    AUD: 8,    NZD: 10,   EUR: 5,    CAD: 8 },
  openApi:       { USD: 1500, GBP: 1125, AUD: 2100, NZD: 2475, EUR: 1260, CAD: 2040 },
  onbLite:       { USD: 1000, GBP: 750,  AUD: 1400, NZD: 1650, EUR: 840,  CAD: 1360 },
  onbStandard:   { USD: 3000, GBP: 2250, AUD: 4200, NZD: 4950, EUR: 2520, CAD: 4080 },
  onbPremium:    { USD: 6000, GBP: 4500, AUD: 8400, NZD: 9900, EUR: 5040, CAD: 8160 },
} satisfies Record<string, Prices>

// ── Add-ons ─────────────────────────────────────────────────────────────────

export interface Addon {
  id: string
  name: string
  prices: Prices
  /** true → priced per student per year; false → flat fee per year */
  perStudent: boolean
}

export const ADDONS = {
  boarding:            { id: 'boarding', name: 'Boarding', prices: P.boardingAddon, perStudent: true },
  nurture:             { id: 'nurture', name: 'Nurture', prices: P.perStudent6, perStudent: true },
  automatedAttendance: { id: 'automated-attendance', name: 'Automated Attendance', prices: P.perStudent6, perStudent: true },
  dismissals:          { id: 'dismissals', name: 'Dismissals', prices: P.perStudent6, perStudent: true },
  openApi:             { id: 'openapi', name: 'Open API Access', prices: P.openApi, perStudent: false },
} satisfies Record<string, Addon>

export interface TierAddon extends Addon {
  /** Already included for base-platform students; buy more only for extra (e.g. day) students. */
  includedInTier?: boolean
  /** Caveat for this tier, shown with an asterisk next to the add-on name. */
  note?: string
}

// ── Tiers ───────────────────────────────────────────────────────────────────

export interface Tier {
  id: string
  name: string
  description: string
  prices: Prices
  featured: boolean
  includesPrefix: string
  /** Supervise tiers: extra per-student charge for boarding students (shown on overview cards). */
  boardingUplift?: Prices
  onboarding: { name: string; prices: Prices }
  /** Add-ons offered in the calculator for this tier. */
  addons: TierAddon[]
  /** Bullet list on the overview plan card. */
  cardFeatures: string[]
}

export const TIERS: Record<Platform, Tier[]> = {
  supervise: [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Insights & Alerts',
      prices: P.basic,
      featured: false,
      includesPrefix: 'Includes:',
      onboarding: { name: 'Onboarding Lite', prices: P.onbLite },
      addons: [
        ADDONS.nurture,
        { ...ADDONS.dismissals, note: 'Only available via CSV import, SIS write back not available' },
      ],
      cardFeatures: ['Attendance insights', 'Automated alerts', 'SIS one-way integration'],
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Class attendance',
      prices: P.pro,
      featured: true,
      includesPrefix: 'Everything in Basic plus:',
      boardingUplift: P.boardingAddon,
      onboarding: { name: 'Onboarding Standard', prices: P.onbStandard },
      addons: [ADDONS.boarding, ADDONS.nurture, ADDONS.automatedAttendance, ADDONS.dismissals, ADDONS.openApi],
      cardFeatures: ['Class schedule', 'Attendance', 'Ad hoc/daily rolls', 'Absences', 'Connect', 'Leave management & events', 'SIS two-way integration', 'Magnus health and integration'],
    },
    {
      id: 'elite',
      name: 'Elite',
      description: 'Full school safety platform',
      prices: P.elite,
      featured: false,
      includesPrefix: 'Everything in Pro plus:',
      boardingUplift: P.boardingAddon,
      onboarding: { name: 'Onboarding Premium', prices: P.onbPremium },
      addons: [ADDONS.boarding, ADDONS.nurture, ADDONS.automatedAttendance, ADDONS.dismissals],
      cardFeatures: ['Emergency rolls', 'Customer emergency alerts', 'Student staff emergency response', 'Visitor management (via Singlewire)', 'Open API access'],
    },
  ],
  boarding: [
    {
      id: 'core',
      name: 'Boarding Core',
      description: 'Boarding Essentials',
      prices: P.boardingCore,
      featured: false,
      includesPrefix: 'Includes:',
      onboarding: { name: 'Onboarding Standard', prices: P.onbStandard },
      addons: [ADDONS.nurture, ADDONS.openApi],
      cardFeatures: ['IP Fraud Detection', 'Houses & Catering', 'Activity Feed + Posts', 'Gating', 'Pastoral Notes', 'Ad Hoc / Daily Rolls', 'Location Overview', 'Late Arrivals & Early Departures', 'NFC Tile Check ins/outs', 'Checkpoint Kiosk App', 'Custom Passes & Events', 'SIS 2-way integration', 'Magnus Health Integration'],
    },
    {
      id: 'pro',
      name: 'Boarding Pro',
      description: 'Complete boarding management solution',
      prices: P.boardingPro,
      featured: true,
      includesPrefix: 'Everything in Core plus:',
      onboarding: { name: 'Onboarding Premium', prices: P.onbPremium },
      addons: [{ ...ADDONS.nurture, includedInTier: true }],
      cardFeatures: ['Medications', 'Connect', 'Nurture mood checks & surveys', 'Emergency Rolls & Templates', 'Custom Emergency Alerts', 'Student & Staff Emergency Response', 'Visitor Management (via Singlewire)', 'Open API Access'],
    },
  ],
}

// ── Compare Plans table (overview page) ─────────────────────────────────────

export interface TableFeature {
  name: string
  /** Tier ids where this feature is included (✓). */
  tiers: string[]
  /** Tier ids where this feature is available as a paid extra instead. */
  paidTiers?: Record<string, Addon>
}

export const TABLE_FEATURES: Record<Platform, Record<string, TableFeature[]>> = {
  supervise: {
    'Attendance': [
      { name: 'Attendance Insights', tiers: ['basic', 'pro', 'elite'] },
      { name: 'Automated Alerts', tiers: ['basic', 'pro', 'elite'] },
      { name: 'Class Schedule Attendance', tiers: ['pro', 'elite'] },
      { name: 'Ad Hoc / Daily Rolls', tiers: ['pro', 'elite'] },
      { name: 'Parent APP for submitting absences', tiers: ['pro', 'elite'] },
      { name: 'Custom Alerts', tiers: ['pro', 'elite'] },
      { name: 'Connect', tiers: ['pro', 'elite'] },
    ],
    'Leave Management': [
      { name: 'Location Overview', tiers: ['pro', 'elite'] },
      { name: 'Late Arrivals', tiers: ['pro', 'elite'] },
      { name: 'Early Departures', tiers: ['pro', 'elite'] },
      { name: 'NFC Tile Check ins/outs', tiers: ['pro', 'elite'] },
      { name: 'Checkpoint Kiosk App', tiers: ['pro', 'elite'] },
      { name: 'Custom Passes', tiers: ['pro', 'elite'] },
      { name: 'Events', tiers: ['pro', 'elite'] },
    ],
    'Emergency Management': [
      { name: 'Emergency Rolls', tiers: ['elite'] },
      { name: 'Emergency Templates', tiers: ['elite'] },
      { name: 'Custom Emergency Alerts', tiers: ['elite'] },
      { name: 'Student Emergency Response', tiers: ['elite'] },
      { name: 'Internal Messaging', tiers: ['elite'] },
      { name: 'Staff Emergency Response', tiers: ['elite'] },
    ],
    'Integrations': [
      { name: 'SIS one-way integration', tiers: ['basic', 'pro', 'elite'] },
      { name: 'SIS 2-way integration', tiers: ['pro', 'elite'] },
      { name: 'Magnus Health Integration', tiers: ['pro', 'elite'] },
      { name: 'Visitor Management (via Singlewire)', tiers: ['elite'] },
      { name: 'Open API Access', tiers: ['elite'], paidTiers: { pro: ADDONS.openApi } },
    ],
  },
  boarding: {
    'Boarding Essentials': [
      { name: 'IP Fraud Detection', tiers: ['core', 'pro'] },
      { name: 'Houses', tiers: ['core', 'pro'] },
      { name: 'Catering', tiers: ['core', 'pro'] },
      { name: 'Activity Feed + Posts', tiers: ['core', 'pro'] },
      { name: 'Gating', tiers: ['core', 'pro'] },
      { name: 'Pastoral Notes and Summaries', tiers: ['core', 'pro'] },
      { name: 'Ad Hoc / Daily Rolls', tiers: ['core', 'pro'] },
      { name: 'Medications', tiers: ['pro'] },
      { name: 'Connect', tiers: ['pro'] },
      { name: 'Nurture mood checks & surveys', tiers: ['pro'], paidTiers: { core: ADDONS.nurture } },
    ],
    'Leave Management': [
      { name: 'Location Overview', tiers: ['core', 'pro'] },
      { name: 'Late Arrivals', tiers: ['core', 'pro'] },
      { name: 'Early Departures', tiers: ['core', 'pro'] },
      { name: 'NFC Tile Check ins/outs', tiers: ['core', 'pro'] },
      { name: 'Checkpoint Kiosk App', tiers: ['core', 'pro'] },
      { name: 'Custom Passes', tiers: ['core', 'pro'] },
      { name: 'Events', tiers: ['core', 'pro'] },
    ],
    'Emergency Management': [
      { name: 'Emergency Rolls', tiers: ['pro'] },
      { name: 'Emergency Templates', tiers: ['pro'] },
      { name: 'Custom Emergency Alerts', tiers: ['pro'] },
      { name: 'Student Emergency Response', tiers: ['pro'] },
      { name: 'Internal Messaging - War room', tiers: ['pro'] },
      { name: 'Staff Emergency Response', tiers: ['pro'] },
    ],
    'Integrations': [
      { name: 'SIS 2-way integration', tiers: ['core', 'pro'] },
      { name: 'Magnus Health Integration', tiers: ['core', 'pro'] },
      { name: 'Visitor Management (via Singlewire)', tiers: ['pro'] },
      { name: 'Open API Access', tiers: ['pro'], paidTiers: { core: ADDONS.openApi } },
    ],
  },
}

/** Add-ons block at the bottom of the Compare Plans table (Supervise only, as in the original). */
export const TABLE_ADDONS: Record<Platform, { addon: Addon; tiers: string[] }[]> = {
  supervise: [
    { addon: ADDONS.boarding, tiers: ['pro', 'elite'] },
    { addon: ADDONS.nurture, tiers: ['basic', 'pro', 'elite'] },
    { addon: ADDONS.automatedAttendance, tiers: ['pro', 'elite'] },
    { addon: ADDONS.dismissals, tiers: ['pro', 'elite'] },
  ],
  boarding: [],
}
