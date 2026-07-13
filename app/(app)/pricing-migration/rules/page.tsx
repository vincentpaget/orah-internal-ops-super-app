'use client';

import { useState } from 'react';
import { PRODUCT_TIER_MAP } from '@/lib/pricing-migration/data/product-mapping';

// ---- Step definitions ----

const STEPS = [
  {
    number: 1,
    title: 'Platform Determination',
    input: 'DB Account (Allowed_Claims_Array__c, Supervise_Use_Case__c, Attendance_Rolls_Scheduled_L90d)',
    output: '"Supervise" or "Boarding"',
    color: 'blue',
    rules: [
      {
        rule: 'Rule 1 — Scheduled Rolls Active',
        detail: 'If the account has an active scheduled_rolls claim AND Attendance_Rolls_Scheduled_L90d > 0 → Platform = Supervise. The customer is actively using roll scheduling, which is a Supervise-specific feature.',
      },
      {
        rule: 'Rule 2 — Boarding Only Use Case',
        detail: 'If Supervise_Use_Case__c = "Boarding Only" → Platform = Boarding. These customers operate a boarding house without a day-school component.',
      },
      {
        rule: 'Rule 3 — Default',
        detail: 'All other accounts → Platform = Supervise. Supervise is the default platform when no boarding-specific signal is present.',
      },
    ],
    notes: [
      'Rules are evaluated in order; the first match wins.',
      'The claims array is stored as a JSON string in DB_Account__c.Allowed_Claims_Array__c and is parsed at runtime.',
      '"Day & Boarding" use-case customers are classified as Supervise (Rule 1 or Rule 3) — they get a Supervise platform plus a Boarding add-on.',
    ],
  },
  {
    number: 2,
    title: 'Tier Mapping',
    input: 'Opportunity Transactions (itemName)',
    output: 'SuperviseTier + BoardingTier (highest across all transactions)',
    color: 'indigo',
    rules: [
      {
        rule: 'Product lookup',
        detail: 'Each transaction\'s itemName is looked up in PRODUCT_TIER_MAP. This returns a superviseTier and boardingTier for that product.',
      },
      {
        rule: 'Tier elevation',
        detail: 'The highest Supervise tier and highest Boarding tier across all transactions is selected. Tier rank: Basic (1) < Pro (2) < Elite (3). A customer on mixed products gets the best tier any of their products maps to.',
      },
      {
        rule: 'Unknown products',
        detail: 'If a product name is not in PRODUCT_TIER_MAP, it defaults to Basic / Core. This is conservative — no unrecognised product elevates the tier.',
      },
      {
        rule: 'Manual review flag',
        detail: '"Custom Subscription Fee" maps to "Requires Manual Review" for both tiers. Any transaction with this product sets hasManualReview = true, which will trigger a "Needs Review" outcome in Step 6.',
      },
    ],
    notes: [],
  },
  {
    number: 3,
    title: 'Quantity Calculation',
    input: 'DB Account (supervise_licences, nurture_licences, boarding_licences, superviseUseCase)',
    output: 'platformLicences, nurtureAddonQty, boardingAddonQty',
    color: 'violet',
    rules: [
      {
        rule: '250-student floor',
        detail: 'Platform licences are floored at 250. If supervise_licences (or the proxy) is less than 250, the platform quantity is set to 250. A note is added explaining the floor was applied.',
      },
      {
        rule: 'Nurture-only proxy',
        detail: 'If supervise_licences is null or 0 but nurture_licences > 0, nurture_licences is used as a proxy for the Supervise platform quantity. A note is added. This handles customers who were sold only nurture products and have no explicit Supervise licence count.',
      },
      {
        rule: 'Boarding add-on (Supervise platform)',
        detail: 'For Supervise customers with use-case "Boarding Only" or "Day & Boarding": boardingAddonQty = supervise_licences. This is a proxy — the actual boarder count may differ, which is why Day & Boarding triggers a Needs Review flag in Step 6.',
      },
      {
        rule: 'Nurture add-on (Boarding platform)',
        detail: 'For Boarding platform customers: nurtureAddonQty = max(0, nurtureLicences − platformLicences). The nurture add-on covers the overage of nurture licences above the boarding platform count.',
      },
    ],
    notes: [
      'boarding_licences from the DB Account is used as the Boarding platform quantity directly (no floor applied to boarding).',
    ],
  },
  {
    number: 4,
    title: 'Price Calculation',
    input: 'Platform, Tier, Quantities, Currency',
    output: 'PriceBreakdown (platform cost + add-on costs + total)',
    color: 'teal',
    rules: [
      {
        rule: 'Currency validation',
        detail: 'The opportunity currency is validated against the supported currencies (USD, GBP, AUD, NZD, EUR, CAD). If unsupported, USD is used as a fallback and a note is added.',
      },
      {
        rule: 'Supervise pricing formula',
        detail: 'Total = (tier price × platformLicences) + (nurture add-on price × nurtureAddonQty) + (boarding add-on price × boardingAddonQty). Add-on lines are only included when the corresponding quantity > 0.',
      },
      {
        rule: 'Boarding pricing formula',
        detail: 'Total = (tier price × platformLicences) + (nurture add-on price × nurtureAddonQty). Note: Core tier includes nurture in the formula; the nurture add-on is available but only for overage above the platform count.',
      },
      {
        rule: 'OpenAPI add-on',
        detail: 'If the current products include Open API, an OpenAPI add-on line is included at a flat fee (e.g. $1,500/yr USD) regardless of licence count.',
      },
    ],
    notes: [
      'All prices are per-student/per-year (or per-boarder for Boarding platform) except OpenAPI which is a flat fee.',
    ],
  },
  {
    number: 5,
    title: 'Claims Gap Analysis',
    input: 'Current claims array, New product configuration',
    output: 'gaps[], sunsetting[], newAllowedClaims[]',
    color: 'amber',
    rules: [
      {
        rule: 'New allowed claims',
        detail: 'getNewAllowedClaims() computes the full set of feature claims covered by the customer\'s new product configuration (tier + add-ons). This is a union of all claims from each active product.',
      },
      {
        rule: 'Gap detection',
        detail: 'A gap is any claim in the customer\'s current allowed claims that is NOT in the new product\'s claim set. Gaps represent features the customer would lose under the new model.',
      },
      {
        rule: 'Sunsetting exclusion',
        detail: 'Claims in the sunsetting set (form_builder, workflow, contact_tracing) are excluded from gap analysis — they are being retired regardless and are not a migration-caused loss. They are surfaced separately for visibility.',
      },
      {
        rule: 'Scheduled rolls exception',
        detail: 'If scheduled_rolls appears as a gap but the account\'s Attendance_Rolls_Scheduled_L90d = 0, the gap is ignored in Step 6. The customer has the claim but hasn\'t used it in 90 days.',
      },
    ],
    notes: [
      'Gaps drive "Needs Review" status in Step 6. Zero effective gaps is required for a "Pass".',
    ],
  },
  {
    number: 6,
    title: 'Outcome Determination',
    input: 'All prior step results, Opportunity (Auto_Renewal_Amount__c, ARR)',
    output: 'status ("Pass" | "Needs Review"), delta, comparisonBaseline, notes[]',
    color: 'rose',
    rules: [
      {
        rule: 'Comparison baseline',
        detail: 'Primary: Opportunity.Auto_Renewal_Amount__c if set. Fallback: (Opportunity.arrBasis ?? DB Account localArr) × 1.07. The fallback applies a standard 7% uplift to the current ARR when no explicit auto-renewal amount exists.',
      },
      {
        rule: 'Delta calculation',
        detail: 'delta = newListPrice − comparisonBaseline. A positive delta means the new model is more expensive than the renewal baseline; negative means it\'s cheaper.',
      },
      {
        rule: 'Pass criteria',
        detail: 'Status = "Pass" only if ALL of the following are true: delta ≥ 0, effective gaps = 0, single DB account, no manual review flag, not a Day & Boarding use-case.',
      },
      {
        rule: 'Grandfathering adjustment',
        detail: 'When a migration is approved, if newListPrice ≥ baseline: a discount % is calculated so the OLIs sum to the baseline amount. If newListPrice < baseline: a scale factor brings OLI unit prices down proportionally. Override lines are not scaled.',
      },
    ],
    notes: [
      'Multiple DB accounts on one opportunity require the migration to be run separately per DB Account and totals rolled up — this is a manual process.',
      '"Needs Review" does not block approval — it is an advisory flag for human review before confirming.',
    ],
  },
];

const NEEDS_REVIEW_TRIGGERS = [
  { condition: 'Price decrease', detail: 'new list price < comparison baseline (delta < 0)' },
  { condition: 'Feature gap', detail: 'customer would lose access to ≥1 active, non-sunsetting feature' },
  { condition: 'Multiple DB Accounts', detail: 'more than one DB_Account__c on the opportunity — requires per-account rollup' },
  { condition: 'Custom Subscription Fee', detail: '"Custom Subscription Fee" product in transactions — cannot be auto-mapped to a tier' },
  { condition: 'Day & Boarding use-case', detail: 'boarding add-on quantity is a proxy (supervise_licences) — actual boarder count needs confirmation' },
];

const STEP_COLORS: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  teal:   'bg-teal-100 text-teal-700 border-teal-200',
  amber:  'bg-amber-100 text-amber-700 border-amber-200',
  rose:   'bg-rose-100 text-rose-700 border-rose-200',
};

const STEP_BORDERS: Record<string, string> = {
  blue:   'border-blue-200',
  indigo: 'border-indigo-200',
  violet: 'border-violet-200',
  teal:   'border-teal-200',
  amber:  'border-amber-200',
  rose:   'border-rose-200',
};

export default function RulesPage() {
  const [openStep, setOpenStep] = useState<number | null>(null);

  const productEntries = Object.entries(PRODUCT_TIER_MAP);

  return (
    <div className="px-8 py-6 space-y-8" style={{ maxWidth: 1100 }}>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Migration Rules & Logic</h1>
        <p className="text-sm text-gray-500 mt-0.5">How the 6-step migration pipeline works</p>
      </div>

      {/* Pipeline overview */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Overview</h2>
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex items-center shrink-0">
              <div
                className={`flex flex-col items-center px-4 py-3 rounded-xl border text-center cursor-pointer transition-all hover:shadow-sm ${STEP_COLORS[step.color]} w-32`}
                onClick={() => setOpenStep(openStep === step.number ? null : step.number)}
              >
                <div className="text-xs font-bold mb-1">Step {step.number}</div>
                <div className="text-xs font-semibold leading-snug">{step.title}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="text-gray-300 px-1 text-lg shrink-0">→</div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Click a step to jump to its detail below.</p>
      </div>

      {/* Step detail cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Step Details</h2>
        {STEPS.map(step => (
          <div key={step.number} className={`bg-white rounded-xl border overflow-hidden ${STEP_BORDERS[step.color]}`}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setOpenStep(openStep === step.number ? null : step.number)}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STEP_COLORS[step.color]}`}>
                  Step {step.number}
                </span>
                <span className="font-semibold text-gray-900 text-sm">{step.title}</span>
              </div>
              <span className="text-gray-400 text-lg">{openStep === step.number ? '▲' : '▼'}</span>
            </button>

            {openStep === step.number && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Input</div>
                    <div className="text-sm text-gray-700">{step.input}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Output</div>
                    <div className="text-sm text-gray-700">{step.output}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500">Rules</div>
                  {step.rules.map(r => (
                    <div key={r.rule} className="flex gap-3">
                      <div className="w-1 shrink-0 rounded-full bg-gray-200 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{r.rule}</div>
                        <div className="text-sm text-gray-600 mt-0.5 leading-relaxed">{r.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {step.notes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 space-y-1">
                    {step.notes.map(n => (
                      <p key={n} className="text-xs text-amber-800 leading-relaxed">⚠ {n}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Needs Review triggers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Needs Review Triggers</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-48">Trigger</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Condition</th>
              </tr>
            </thead>
            <tbody>
              {NEEDS_REVIEW_TRIGGERS.map((t, i) => (
                <tr key={t.condition} className={`border-t border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-orange-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      {t.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product → Tier mapping table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Product → Tier Mapping</h2>
        <p className="text-xs text-gray-500 mb-3">
          How legacy product names map to the new tier structure. When a customer has multiple products, the highest Supervise tier and highest Boarding tier across all products are used.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Legacy Product Name</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Supervise Tier</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Boarding Tier</th>
              </tr>
            </thead>
            <tbody>
              {productEntries.map(([name, mapping], i) => (
                <tr key={name} className={`border-t border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <TierBadge tier={mapping.superviseTier} type="supervise" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <TierBadge tier={mapping.boardingTier} type="boarding" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier, type }: { tier: string; type: 'supervise' | 'boarding' }) {
  const isReview = tier === 'Requires Manual Review';
  if (isReview) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
        Manual Review
      </span>
    );
  }

  const superviseColors: Record<string, string> = {
    Basic: 'bg-sky-100 text-sky-700 border-sky-200',
    Pro:   'bg-blue-100 text-blue-700 border-blue-200',
    Elite: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  };
  const boardingColors: Record<string, string> = {
    Core: 'bg-purple-100 text-purple-700 border-purple-200',
    Pro:  'bg-violet-100 text-violet-700 border-violet-200',
  };

  const cls = type === 'supervise' ? superviseColors[tier] : boardingColors[tier];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls ?? ''}`}>
      {tier}
    </span>
  );
}
