'use client';

import { useState, useMemo, useEffect } from 'react';
import { runMigration } from '@/lib/pricing-migration/migration/run-migration';
import type { DBAccount, Transaction, RenewalOpportunity, MigrationResult } from '@/lib/pricing-migration/migration/types';
import { CURRENCIES } from '@/lib/pricing-migration/data/pricelist';

export interface PreviewData {
  accountId: string;
  accountName: string;
  currency: string;
  currentLocalCARR: number | null;
  lastPricebookId: string | null;
  dbAccount: DBAccount | null;
  transactions: Transaction[];
}

interface Overrides {
  superviseLicences: number;
  nurtureLicences: number;
  superviseUseCase: DBAccount['superviseUseCase'];
  currency: string;
}

function fmt(n: number, currency: string) {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

function DeltaLine({ delta, currency }: { delta: number; currency: string }) {
  if (delta === 0) return <span className="text-gray-500">No change vs baseline</span>;
  const up = delta > 0;
  return (
    <span className={up ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
      {up ? '↑' : '↓'} {fmt(Math.abs(delta), currency)} {up ? 'above' : 'below'} baseline
    </span>
  );
}

const PLATFORM_COLORS: Record<string, string> = {
  Supervise: 'bg-blue-50 text-blue-700 border-blue-200',
  Boarding:  'bg-purple-50 text-purple-700 border-purple-200',
};

const TIER_COLORS: Record<string, string> = {
  Basic:                  'bg-gray-50 text-gray-600 border-gray-200',
  Pro:                    'bg-blue-50 text-blue-600 border-blue-200',
  Elite:                  'bg-indigo-50 text-indigo-700 border-indigo-200',
  Core:                   'bg-gray-50 text-gray-600 border-gray-200',
  'Requires Manual Review': 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function MigrationPreview({ data, onResult }: {
  data: PreviewData;
  onResult?: (result: MigrationResult | null) => void;
}) {
  const { dbAccount, transactions } = data;

  const [overrides, setOverrides] = useState<Overrides>(() => ({
    superviseLicences: dbAccount?.superviseLicences ?? 0,
    nurtureLicences:   dbAccount?.nurtureLicences ?? 0,
    superviseUseCase:  dbAccount?.superviseUseCase ?? null,
    currency:          data.currency,
  }));

  const effectiveAccount = useMemo<DBAccount | null>(() => {
    if (!dbAccount) return null;
    return {
      ...dbAccount,
      superviseLicences: overrides.superviseLicences,
      nurtureLicences:   overrides.nurtureLicences,
      superviseUseCase:  overrides.superviseUseCase,
    };
  }, [dbAccount, overrides]);

  const syntheticOpp = useMemo<RenewalOpportunity>(() => ({
    id: 'preview',
    name: 'Preview',
    stageName: null,
    type: null,
    contractStartDate: null,
    closeDate: null,
    ownerId: '',
    pricebook2Id: null,
    autoRenewalAmount: null,
    currencyIsoCode: overrides.currency,
    arrBasis: effectiveAccount?.localArr ?? null,
    bookedArr: null,
    netArr: null,
    managedAccounts: null,
    doNotAutoRenew: null,
    orderNotes: null,
    renewalProductsConfirmed: null,
  }), [overrides.currency, effectiveAccount?.localArr]);

  const result = useMemo(() => {
    if (!effectiveAccount) return null;
    return runMigration(effectiveAccount, syntheticOpp, transactions, false);
  }, [effectiveAccount, syntheticOpp, transactions]);

  // Notify parent when result changes (used for contract-level rollup)
  useEffect(() => {
    onResult?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const currentArrTotal = transactions.reduce((sum, tx) => sum + (tx.localArr ?? 0), 0);
  const isDirty =
    overrides.superviseLicences !== (dbAccount?.superviseLicences ?? 0) ||
    overrides.nurtureLicences   !== (dbAccount?.nurtureLicences ?? 0) ||
    overrides.superviseUseCase  !== (dbAccount?.superviseUseCase ?? null) ||
    overrides.currency          !== data.currency;

  if (!dbAccount) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">No DB Account linked</p>
        <p className="text-xs text-gray-400">This account doesn&apos;t have a linked DB Account record. Migration preview is not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Adjustable inputs */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adjust Inputs</span>
          {isDirty && (
            <button onClick={() => setOverrides({
              superviseLicences: dbAccount.superviseLicences ?? 0,
              nurtureLicences:   dbAccount.nurtureLicences ?? 0,
              superviseUseCase:  dbAccount.superviseUseCase ?? null,
              currency:          data.currency,
            })} className="text-xs text-blue-600 hover:underline">
              Reset to Salesforce values
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Supervise Licences</span>
            <input type="number" min={0} value={overrides.superviseLicences}
              onChange={e => setOverrides(v => ({ ...v, superviseLicences: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Nurture Licences</span>
            <input type="number" min={0} value={overrides.nurtureLicences}
              onChange={e => setOverrides(v => ({ ...v, nurtureLicences: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Use Case</span>
            <select value={overrides.superviseUseCase ?? ''}
              onChange={e => setOverrides(v => ({
                ...v,
                superviseUseCase: (e.target.value || null) as DBAccount['superviseUseCase'],
              }))}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">— Not set</option>
              <option value="Day Only">Day Only</option>
              <option value="Boarding Only">Boarding Only</option>
              <option value="Day &amp; Boarding">Day &amp; Boarding</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Currency</span>
            <select value={overrides.currency}
              onChange={e => setOverrides(v => ({ ...v, currency: e.target.value }))}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Side-by-side: Current vs New */}
      <div className="grid grid-cols-2 gap-4">

        {/* Current subscription */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Subscription</div>
          {transactions.length > 0 ? (
            <>
              <div className="flex-1 space-y-2.5">
                {transactions.map(tx => (
                  <div key={tx.id} className="pb-2.5 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="text-xs font-medium text-gray-800 leading-snug">{tx.itemName}</div>
                    {tx.studentProfiles != null && (
                      <div className="text-xs text-gray-400 mt-0.5">{tx.studentProfiles.toLocaleString()} students</div>
                    )}
                    <div className="text-xs font-semibold text-gray-700 mt-0.5">
                      {tx.localArr != null ? fmt(tx.localArr, tx.currencyCode) : '—'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Total ARR</span>
                <span className="text-sm font-bold text-gray-900">{fmt(currentArrTotal, overrides.currency)}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 flex-1">No active transaction lines found</p>
          )}
        </div>

        {/* New pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">New Pricing</div>
          {result ? (
            <>
              {/* Platform + tier badges */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${PLATFORM_COLORS[result.step1.platform]}`}>
                  {result.step1.platform}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${TIER_COLORS[result.step2.tier] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {result.step2.tier}
                </span>
              </div>

              {/* Price breakdown lines */}
              <div className="flex-1 space-y-1.5">
                {result.step4.priceBreakdown.platformCost > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Platform · {result.step3.quantities.platformLicences.toLocaleString()} licences</span>
                    <span className="font-medium text-gray-900">{fmt(result.step4.priceBreakdown.platformCost, overrides.currency)}</span>
                  </div>
                )}
                {result.step4.priceBreakdown.nurtureAddonCost > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Nurture add-on · {result.step3.quantities.nurtureAddonQuantity.toLocaleString()}</span>
                    <span className="font-medium text-gray-900">{fmt(result.step4.priceBreakdown.nurtureAddonCost, overrides.currency)}</span>
                  </div>
                )}
                {result.step4.priceBreakdown.boardingAddonCost > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Boarding add-on · {result.step3.quantities.boardingAddonQuantity.toLocaleString()}</span>
                    <span className="font-medium text-gray-900">{fmt(result.step4.priceBreakdown.boardingAddonCost, overrides.currency)}</span>
                  </div>
                )}
                {result.step2.tier === 'Requires Manual Review' && (
                  <p className="text-xs text-orange-600">Manual review required — price cannot be calculated automatically</p>
                )}
              </div>

              {/* Total + delta */}
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">New List Price</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(result.step4.priceBreakdown.total, overrides.currency)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Baseline {fmt(result.step6.comparisonBaseline, overrides.currency)} · {' '}
                  <DeltaLine delta={result.step6.delta} currency={overrides.currency} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400">Run the preview to see new pricing</p>
          )}
        </div>
      </div>

      {/* Status + review notes */}
      {result && (
        <div className={`rounded-xl border p-4 ${
          result.step6.status === 'Pass'
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className={`text-sm font-bold mb-1 ${result.step6.status === 'Pass' ? 'text-green-700' : 'text-amber-700'}`}>
            {result.step6.status === 'Pass' ? '✓ Ready to migrate' : '⚠ Needs review'}
          </div>
          {result.step6.notes.length > 0 && (
            <ul className="space-y-1">
              {result.step6.notes.map((n, i) => (
                <li key={i} className="text-xs text-gray-700 leading-relaxed">• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Claims gap */}
      {result && (result.step5.claimsGap.gaps.length > 0 || result.step5.claimsGap.sunsetting.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Feature Access</div>
          {result.step5.claimsGap.gaps.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-red-600 mb-1">Would lose access to:</div>
              <div className="flex flex-wrap gap-1">
                {result.step5.claimsGap.gaps.map(g => (
                  <span key={g} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-full">{g}</span>
                ))}
              </div>
            </div>
          )}
          {result.step5.claimsGap.sunsetting.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Sunsetting (no action needed):</div>
              <div className="flex flex-wrap gap-1">
                {result.step5.claimsGap.sunsetting.map(g => (
                  <span key={g} className="px-2 py-0.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs rounded-full">{g}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform logic detail */}
      {result && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How this was determined</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-medium">Platform:</span> {result.step1.reason}
          </p>
          {result.step2.productTierMapping.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-gray-500 mb-1">Product → Tier mapping:</div>
              <ul className="space-y-0.5">
                {result.step2.productTierMapping.map((m, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {m.productName} <span className="text-gray-400">→</span> <span className="font-medium">{m.tier}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.step3.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {result.step3.notes.map((n, i) => (
                <li key={i} className="text-xs text-gray-600">• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
