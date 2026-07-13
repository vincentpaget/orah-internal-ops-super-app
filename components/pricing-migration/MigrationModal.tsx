'use client';

import { useState, useMemo, useRef } from 'react';
import type { MigrationResult, Step5Result } from '@/lib/pricing-migration/migration/types';
import { getClaimName } from '@/lib/pricing-migration/data/feature-claims';
import { SUPERVISE_TIER_PRICES, BOARDING_TIER_PRICES, ADDON_PRICES, PRODUCT_IDS } from '@/lib/pricing-migration/data/pricelist';
import type { Currency } from '@/lib/pricing-migration/data/pricelist';
import { determineOutcome } from '@/lib/pricing-migration/migration/step6-outcome';
import { getNewAllowedClaims, SUNSETTING_CLAIMS } from '@/lib/pricing-migration/data/feature-claims';
import type { ActiveProducts } from '@/lib/pricing-migration/data/feature-claims';
import ApproveButton from './ApproveButton';
import type { OliLine } from './MigrationTable';

export interface EditableLine {
  id: string;
  productKey: keyof typeof PRODUCT_IDS;
  quantity: number;
  unitPrice: number;
}

export type ModalEntry =
  | { kind: 'pending';  data: MigrationResult }
  | { kind: 'migrated'; data: MigrationResult; currentOlis: OliLine[] }
  | { kind: 'approved'; data: MigrationResult };

export interface ApprovedSnapshot {
  lines: EditableLine[];
  renewalProductsConfirmed: boolean;
  orderNotes: string;
}

interface Props {
  entries: ModalEntry[];
  initialIndex: number;
  instanceUrl: string;
  approvedSnapshots: Record<string, ApprovedSnapshot>;
  onClose: () => void;
  onApproved: (opportunityId: string, confirmed: boolean, snapshot: ApprovedSnapshot) => void;
  onReviewed: (opportunityId: string) => void;
}

// ── Pricing helpers ──────────────────────────────────────────────────────────

const PRODUCT_KEY_LABELS: Record<keyof typeof PRODUCT_IDS, string> = {
  SuperviseBasic:      'Supervise Basic',
  SupervisePro:        'Supervise Pro',
  SuperviseElite:      'Supervise Elite',
  BoardingCore:        'Boarding Core',
  BoardingPro:         'Boarding Pro',
  AddonBoarding:       'Add-on: Boarding Students',
  AddonNurture:        'Add-on: Nurture',
  AddonAutoAttendance: 'Add-on: Auto Attendance',
  AddonDismissals:     'Add-on: Dismissals',
  AddonOpenAPI:        'Add-on: Open API',
};

const ALL_PRODUCT_KEYS = Object.keys(PRODUCT_KEY_LABELS) as (keyof typeof PRODUCT_IDS)[];

const PRODUCT_ID_TO_KEY = Object.fromEntries(
  Object.entries(PRODUCT_IDS).map(([k, v]) => [v, k])
) as Record<string, keyof typeof PRODUCT_IDS>;

const TIER_COLORS: Record<string, string> = {
  Basic:  'bg-gray-100 text-gray-600',
  Pro:    'bg-blue-100 text-blue-700',
  Elite:  'bg-indigo-100 text-indigo-700',
  Core:   'bg-gray-100 text-gray-600',
  'Requires Manual Review': 'bg-orange-100 text-orange-700',
};

function getUnitPriceForKey(key: keyof typeof PRODUCT_IDS, ccy: Currency): number {
  switch (key) {
    case 'SuperviseBasic':      return SUPERVISE_TIER_PRICES.Basic[ccy];
    case 'SupervisePro':        return SUPERVISE_TIER_PRICES.Pro[ccy];
    case 'SuperviseElite':      return SUPERVISE_TIER_PRICES.Elite[ccy];
    case 'BoardingCore':        return BOARDING_TIER_PRICES.Core[ccy];
    case 'BoardingPro':         return BOARDING_TIER_PRICES.Pro[ccy];
    case 'AddonBoarding':       return ADDON_PRICES.Boarding[ccy];
    case 'AddonNurture':        return ADDON_PRICES.Nurture[ccy];
    case 'AddonAutoAttendance': return ADDON_PRICES.AutomatedAttendance[ccy];
    case 'AddonDismissals':     return ADDON_PRICES.Dismissals[ccy];
    case 'AddonOpenAPI':        return ADDON_PRICES.OpenAPI[ccy];
  }
}

function getTierKey(platform: string, tier: string): keyof typeof PRODUCT_IDS {
  if (platform === 'Supervise') {
    return tier === 'Basic' ? 'SuperviseBasic' : tier === 'Elite' ? 'SuperviseElite' : 'SupervisePro';
  }
  return tier === 'Core' ? 'BoardingCore' : 'BoardingPro';
}

function linesToActiveProducts(lines: EditableLine[]): ActiveProducts {
  const keys = new Set(lines.map(l => l.productKey));
  return {
    superviseTier: keys.has('SuperviseElite') ? 'Elite' : keys.has('SupervisePro') ? 'Pro' : keys.has('SuperviseBasic') ? 'Basic' : undefined,
    boardingTier:  keys.has('BoardingPro') ? 'Pro' : keys.has('BoardingCore') ? 'Core' : undefined,
    hasBoardingAddon:       keys.has('AddonBoarding'),
    hasNurtureAddon:        keys.has('AddonNurture'),
    hasAutoAttendanceAddon: keys.has('AddonAutoAttendance'),
    hasDismissalsAddon:     keys.has('AddonDismissals'),
    hasOpenApiAddon:        keys.has('AddonOpenAPI'),
  };
}

function buildLinesFromEngine(data: MigrationResult, ccy: Currency): EditableLine[] {
  const tierKey = getTierKey(data.step1.platform, data.step2.tier);
  const { step3 } = data;
  const lines: EditableLine[] = [
    { id: '1', productKey: tierKey, quantity: step3.quantities.platformLicences, unitPrice: getUnitPriceForKey(tierKey, ccy) },
  ];
  if (step3.quantities.nurtureAddonQuantity > 0)
    lines.push({ id: '2', productKey: 'AddonNurture', quantity: step3.quantities.nurtureAddonQuantity, unitPrice: getUnitPriceForKey('AddonNurture', ccy) });
  if (step3.quantities.boardingAddonQuantity > 0)
    lines.push({ id: '3', productKey: 'AddonBoarding', quantity: step3.quantities.boardingAddonQuantity, unitPrice: getUnitPriceForKey('AddonBoarding', ccy) });
  return lines;
}

function buildLinesFromOlis(currentOlis: OliLine[], data: MigrationResult, ccy: Currency): EditableLine[] {
  const lines = currentOlis
    .map((oli, i): EditableLine | null => {
      const productKey = oli.product2Id ? (PRODUCT_ID_TO_KEY[oli.product2Id] ?? null) : null;
      if (!productKey) return null;
      return { id: String(i + 1), productKey, quantity: oli.quantity, unitPrice: oli.unitPrice };
    })
    .filter((l): l is EditableLine => l !== null);
  return lines.length > 0 ? lines : buildLinesFromEngine(data, ccy);
}

function fmtCurrency(val: number | null | undefined, currency: string): string {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function fmtPct(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(0)}%`;
}

// ── Outer component (manages navigation index) ───────────────────────────────

export default function MigrationModal({ entries, initialIndex, instanceUrl, approvedSnapshots, onClose, onApproved, onReviewed }: Props) {
  const [idx, setIdx] = useState(initialIndex);

  const entry = idx < entries.length ? entries[idx] : null;
  if (!entry) return null;

  const oppId = entry.data.opportunityId;
  const initialOverrides = entry.kind === 'approved' ? approvedSnapshots[oppId] : undefined;

  function navigate(next: number) {
    setIdx(Math.max(0, Math.min(entries.length - 1, next)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <ModalContent
          key={`${idx}-${oppId}`}
          entry={entry}
          idx={idx}
          total={entries.length}
          instanceUrl={instanceUrl}
          initialOverrides={initialOverrides}
          onClose={onClose}
          onApproved={(id, snapshot) => {
            onApproved(id, snapshot.renewalProductsConfirmed, snapshot);
          }}
          onReviewed={(id) => {
            onReviewed(id);
            const newLen = entries.length - 1;
            if (newLen === 0) { onClose(); return; }
            if (idx >= newLen) setIdx(newLen - 1);
          }}
          onNext={() => navigate(idx + 1)}
          onPrev={() => navigate(idx - 1)}
          isFirst={idx === 0}
          isLast={idx === entries.length - 1}
        />
      </div>
    </div>
  );
}

// ── Inner content (keyed — all state resets on navigation) ───────────────────

interface ContentProps {
  entry: ModalEntry;
  idx: number;
  total: number;
  instanceUrl: string;
  initialOverrides?: ApprovedSnapshot;
  onClose: () => void;
  onApproved: (id: string, snapshot: ApprovedSnapshot) => void;
  onReviewed: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function ModalContent({ entry, idx, total, instanceUrl, initialOverrides, onClose, onApproved, onReviewed, onNext, onPrev, isFirst, isLast }: ContentProps) {
  const { data } = entry;
  const ccy = data.currency as Currency;
  const platform = data.step1.platform;
  const { step1, step2, step3, step5, rawInputs } = data;

  const [sec1Open, setSec1Open] = useState(false);
  const [sec2Open, setSec2Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(true);
  const [sec4Open, setSec4Open] = useState(true);
  const [matchAutoRenewal, setMatchAutoRenewal] = useState(false);
  const [renewalProductsConfirmed, setRenewalProductsConfirmed] = useState(
    initialOverrides?.renewalProductsConfirmed ?? data.renewalProductsConfirmed ?? false
  );
  const [orderNotes, setOrderNotes] = useState(
    initialOverrides?.orderNotes ?? data.orderNotes ?? ''
  );
  const [fieldsSaveState, setFieldsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [fieldsSaveError, setFieldsSaveError] = useState('');
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'error'>('idle');
  const lineIdRef = useRef(100);

  const [editableLines, setEditableLines] = useState<EditableLine[]>(() => {
    if (initialOverrides) return initialOverrides.lines;
    if (entry.kind === 'migrated') return buildLinesFromOlis(entry.currentOlis, data, ccy);
    return buildLinesFromEngine(data, ccy);
  });

  const baseTotal = useMemo(
    () => editableLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [editableLines]
  );

  const listTotal = useMemo(
    () => editableLines.reduce((sum, l) => sum + l.quantity * getUnitPriceForKey(l.productKey, ccy), 0),
    [editableLines, ccy]
  );

  const autoRenewalBaseline = data.autoRenewalAmount ?? ((data.arrBasis ?? rawInputs.localArr ?? 0) * 1.07);
  const renewalScale = matchAutoRenewal && baseTotal > 0 ? autoRenewalBaseline / baseTotal : 1;
  const effectiveTotal = matchAutoRenewal && baseTotal > 0 ? autoRenewalBaseline : baseTotal;

  const manualStep5 = useMemo((): Step5Result => {
    const newAllowed = getNewAllowedClaims(linesToActiveProducts(editableLines));
    const gaps = step5.currentClaims.filter(c => !newAllowed.has(c) && !SUNSETTING_CLAIMS.has(c));
    const sunsetting = step5.currentClaims.filter(c => SUNSETTING_CLAIMS.has(c));
    return { claimsGap: { gaps, sunsetting }, newAllowedClaims: [...newAllowed], currentClaims: step5.currentClaims };
  }, [editableLines, step5.currentClaims]);

  const manualStep6 = useMemo(() => {
    const fakeAccount = {
      id: '', analyticsGroupId: '',
      attendanceRollsScheduledL90d: rawInputs.attendanceRollsL90d,
      superviseUseCase: rawInputs.superviseUseCase as Parameters<typeof determineOutcome>[1]['superviseUseCase'],
      localArr: rawInputs.localArr,
      superviseLicences: null, nurtureLicences: null, allowedClaimsArray: null,
      homeArr: null, localCarr: null, homeCarr: null, activeStudentProfiles: null,
    } as Parameters<typeof determineOutcome>[1];
    const fakeOpp = {
      id: '', name: '', stageName: null, contractStartDate: null, closeDate: null,
      ownerId: '', pricebook2Id: null, currencyIsoCode: ccy,
      autoRenewalAmount: data.autoRenewalAmount,
      arrBasis: data.arrBasis,
    } as Parameters<typeof determineOutcome>[2];
    return determineOutcome(platform, fakeAccount, fakeOpp, effectiveTotal, step2, manualStep5, data.multipleDbAccounts);
  }, [effectiveTotal, manualStep5, platform, rawInputs, data.autoRenewalAmount, data.arrBasis, data.multipleDbAccounts, step2, ccy]);

  function addLine() {
    setEditableLines(prev => [...prev, {
      id: String(lineIdRef.current++),
      productKey: getTierKey(platform, step2.tier),
      quantity: 1,
      unitPrice: getUnitPriceForKey(getTierKey(platform, step2.tier), ccy),
    }]);
  }

  function removeLine(id: string) {
    setEditableLines(prev => prev.filter(l => l.id !== id));
  }

  function updateLine(id: string, field: 'productKey' | 'quantity' | 'unitPrice', value: string) {
    setEditableLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      if (field === 'productKey') {
        const key = value as keyof typeof PRODUCT_IDS;
        return { ...l, productKey: key, unitPrice: getUnitPriceForKey(key, ccy) };
      }
      return { ...l, [field]: parseFloat(value) || 0 };
    }));
  }

  function resetToDefaultMigration() {
    setEditableLines(buildLinesFromEngine(data, ccy));
  }

  function resetToOpportunityProducts() {
    if (entry.kind === 'migrated') {
      setEditableLines(buildLinesFromOlis(entry.currentOlis, data, ccy));
    }
  }

  async function refreshFromSF() {
    setRefreshState('loading');
    try {
      const res = await fetch(`/api/pricing-migration/migration/opportunity/${data.opportunityId}`);
      const json = await res.json();
      if (!res.ok) { setRefreshState('error'); return; }
      setOrderNotes(json.orderNotes ?? '');
      setRenewalProductsConfirmed(json.renewalProductsConfirmed ?? false);
      setFieldsSaveState('idle');
      setRefreshState('idle');
    } catch { setRefreshState('error'); }
  }

  async function saveFields() {
    setFieldsSaveState('saving'); setFieldsSaveError('');
    try {
      const res = await fetch('/api/pricing-migration/migration/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: data.opportunityId,
          renewalProductsConfirmed,
          orderNotes: orderNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFieldsSaveError(json.error ?? 'Failed'); setFieldsSaveState('error'); }
      else { setFieldsSaveState('saved'); setTimeout(() => setFieldsSaveState('idle'), 2500); }
    } catch { setFieldsSaveError('Request failed'); setFieldsSaveState('error'); }
  }

  const rightColLabel = entry.kind === 'migrated' ? 'CURRENT OPPORTUNITY PRODUCTS' : 'NEW PRODUCTS';
  const canResetToOli = entry.kind === 'migrated';

  // Section 2 left panel: join tier mapping with transactions
  const productRows = step2.productTierMapping.map(m => {
    const tx = rawInputs.transactions.find(t => t.productName === m.productName);
    return { productName: m.productName, quantity: tx?.quantity ?? null, tier: m.tier };
  });

  // Section 3 claim categories
  const claimGaps = manualStep5.claimsGap.gaps;
  const sunsetCodes = new Set(manualStep5.claimsGap.sunsetting);
  // Sunsetting claims sorted to end of covered list
  const claimCovered = step5.currentClaims
    .filter(c => !claimGaps.includes(c))
    .sort((a, b) => (sunsetCodes.has(a) ? 1 : 0) - (sunsetCodes.has(b) ? 1 : 0));
  const claimGains = manualStep5.newAllowedClaims.filter(
    c => !step5.currentClaims.includes(c) && !SUNSETTING_CLAIMS.has(c)
  );

  // Footer calculations
  const listDelta = listTotal - autoRenewalBaseline;
  const listDeltaPct = autoRenewalBaseline > 0 ? (listDelta / autoRenewalBaseline) * 100 : 0;
  const finalDelta = effectiveTotal - autoRenewalBaseline;
  const finalDeltaPct = autoRenewalBaseline > 0 ? (finalDelta / autoRenewalBaseline) * 100 : 0;

  const overrideLines = editableLines.map(l => ({
    ...l,
    unitPrice: parseFloat((l.unitPrice * renewalScale).toFixed(4)),
  }));

  const sfUrl = instanceUrl ? `${instanceUrl}/${data.opportunityId}` : null;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 leading-snug">{data.opportunityName}</h2>
              {data.renewalDate && (
                <span className="text-sm text-gray-400 font-normal">Renewal {data.renewalDate}</span>
              )}
              {sfUrl && (
                <a href={sfUrl} target="_blank" rel="noopener noreferrer"
                  className="text-gray-300 hover:text-blue-500 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
                    <path d="M8 1h3v3M11 1 6 6" />
                  </svg>
                </a>
              )}
            </div>
            {/* Chips row */}
            <div className="flex items-center gap-x-2 gap-y-1.5 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{ccy}</span>

              <span className="text-gray-200 select-none">·</span>
              <span className="text-xs text-gray-400">Booked ARR</span>
              <span className="text-xs font-medium text-gray-700">{fmtCurrency(data.bookedArr, ccy)}</span>

              <span className="text-gray-200 select-none">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platform === 'Supervise' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>{platform}</span>

              {data.stageName && (
                <>
                  <span className="text-gray-200 select-none">·</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{data.stageName}</span>
                </>
              )}

              {data.type && (
                <>
                  <span className="text-gray-200 select-none">·</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{data.type}</span>
                </>
              )}

              <span className="text-gray-200 select-none">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${manualStep6.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {manualStep6.status}
              </span>

              {[
                manualStep5.claimsGap.gaps.length > 0   && { label: 'Feature gaps',          cls: 'bg-red-50 text-red-700 border border-red-200' },
                manualStep6.delta < 0                   && { label: 'Price < renewal',        cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
                data.multipleDbAccounts                 && { label: 'Multiple DB accounts',   cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
                step2.hasManualReview                   && { label: 'Custom products',        cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
              ].filter(Boolean).map(f => f && (
                <span key={f.label} className={`text-xs px-2 py-0.5 rounded-full ${f.cls}`}>{f.label}</span>
              ))}
            </div>
          </div>
          {/* Refresh + Nav + close */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={refreshFromSF}
              disabled={refreshState === 'loading'}
              title={refreshState === 'error' ? 'Refresh failed — retry?' : 'Refresh from Salesforce'}
              className={`p-1.5 rounded transition-colors ${refreshState === 'error' ? 'text-red-400 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-100 hover:text-blue-500'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                className={refreshState === 'loading' ? 'animate-spin' : ''}>
                <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" />
                <path d="M13.5 2v3h-3" />
              </svg>
            </button>
            <button onClick={onPrev} disabled={isFirst}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4l-4 4 4 4" /></svg>
            </button>
            <span className="text-xs text-gray-400 tabular-nums w-12 text-center">{idx + 1} / {total}</span>
            <button onClick={onNext} disabled={isLast}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" /></svg>
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">×</button>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex-1">

        {/* Section 1 — Platform Selection */}
        <div className="border-b">
          <button
            onClick={() => setSec1Open(o => !o)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">1</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">Platform Selection</div>
              <div className="text-xs text-gray-400 mt-0.5">Account data determines the platform this school migrates to</div>
            </div>
            {!sec1Open && (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 bg-gray-100 text-gray-700">
                {platform}
              </span>
            )}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              className={`shrink-0 text-gray-400 transition-transform ${sec1Open ? 'rotate-180' : ''}`}>
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {sec1Open && (
            <div className="px-6 pb-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-4 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Field</th>
                    <th className="py-2 pr-4 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                    <th className="py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Platform Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <PlatformRow label="Supervise_Licences__c"       value={rawInputs.superviseLicences ?? '—'} />
                  <PlatformRow label="Nurture_Licences__c"         value={rawInputs.nurtureLicences ?? '—'} />
                  <PlatformRow label="Supervise_Use_Case__c"       value={rawInputs.superviseUseCase ?? '—'}
                    logic={rawInputs.superviseUseCase === 'Boarding Only' ? `is Boarding Only` : undefined} />
                  <PlatformRow label="Attendance_Rolls_Scheduled_L90d" value={step1.conditions.attendanceRollsL90d ?? '—'}
                    logic={(step1.conditions.attendanceRollsL90d ?? 0) > 0 ? '≥ 1 → eligible' : undefined} />
                  <PlatformRow label="scheduled_rolls in claims"   value={step1.conditions.scheduledRollsInClaims ? 'Yes' : 'No'}
                    logic={step1.conditions.scheduledRollsInClaims ? 'is Yes → eligible' : undefined} />
                  <PlatformRow label="Local_ARR__c"                value={fmtCurrency(rawInputs.localArr, ccy)} />
                  <PlatformRow label="Active_Student_Profiles__c"  value={rawInputs.activeStudentProfiles ?? '—'} />
                </tbody>
              </table>
              {/* Determined platform row */}
              <div className="mt-2 flex items-start gap-3 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-blue-500 text-base mt-0.5">🏁</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-800">Determined platform</span>
                    <span className="text-[10px] text-blue-400">Rule {step1.conditions.ruleApplied}</span>
                  </div>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-snug">{step1.reason}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-700 shrink-0">
                  {platform}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2 — Products & Migration Pricing */}
        <div className="border-b">
          <button
            onClick={() => setSec2Open(o => !o)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">2</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">Product Mapping</div>
              <div className="text-xs text-gray-400 mt-0.5">Map the legacy contract onto the new model ({ccy})</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              className={`shrink-0 text-gray-400 transition-transform ${sec2Open ? 'rotate-180' : ''}`}>
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {sec2Open && (
            <div className="px-6 pb-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    {/* Section label row */}
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th colSpan={3} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Current Products
                      </th>
                      <th colSpan={6} className="px-4 py-2.5 border-l border-gray-200 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        {rightColLabel}
                      </th>
                    </tr>
                    {/* Column header row */}
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-1.5 text-left text-[10px] font-medium text-gray-400">Product</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-400 w-10">Qty</th>
                      <th className="px-4 py-1.5 text-right text-[10px] font-medium text-gray-400 w-40">Maps to</th>
                      <th className="px-4 py-1.5 text-left text-[10px] font-medium text-gray-400 border-l border-gray-200">Product</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-400 w-10">Qty</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-400 w-20">List price</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-400 w-24">Sales price</th>
                      <th className="px-4 py-1.5 text-right text-[10px] font-medium text-gray-400 w-20">Total</th>
                      <th className="w-5 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from({ length: Math.max(productRows.length, editableLines.length) }, (_, i) => {
                      const left = productRows[i] ?? null;
                      const right = editableLines[i] ?? null;
                      const listPrice = right ? getUnitPriceForKey(right.productKey, ccy) : 0;
                      const effSalesPrice = right ? parseFloat((right.unitPrice * renewalScale).toFixed(2)) : 0;
                      const lineTotal = right ? right.quantity * effSalesPrice : 0;
                      return (
                        <tr key={i}>
                          {/* Left: legacy product */}
                          {left ? (
                            <>
                              <td className="px-4 py-2 text-gray-800 font-medium" title={left.productName}>
                                <div className="truncate max-w-[160px]">{left.productName}</div>
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-500">
                                {left.quantity != null ? left.quantity : '—'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {left.tier === 'Requires Manual Review'
                                  ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${TIER_COLORS['Requires Manual Review']}`}>Manual</span>
                                  : <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${TIER_COLORS[left.tier] ?? 'bg-gray-100 text-gray-700'}`}>{platform} {left.tier}</span>
                                }
                              </td>
                            </>
                          ) : (
                            <td colSpan={3} className="px-4 py-2" />
                          )}
                          {/* Right: new product */}
                          {right ? (
                            <>
                              <td className="px-4 py-2 border-l border-gray-200">
                                <select value={right.productKey} onChange={e => updateLine(right.id, 'productKey', e.target.value)}
                                    className="text-[11px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-blue-400 w-full max-w-[160px]">
                                    {ALL_PRODUCT_KEYS.map(k => <option key={k} value={k}>{PRODUCT_KEY_LABELS[k]}</option>)}
                                  </select>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <input type="number" value={right.quantity} min={0}
                                    onChange={e => updateLine(right.id, 'quantity', e.target.value)}
                                    className="text-[11px] border border-gray-200 rounded px-1 py-0.5 text-right w-14 focus:outline-none focus:border-blue-400" />
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-400">
                                {fmtCurrency(listPrice, ccy)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {matchAutoRenewal
                                  ? <span className={`tabular-nums ${matchAutoRenewal && renewalScale !== 1 ? 'text-blue-600' : 'text-gray-700'}`}>
                                      {fmtCurrency(effSalesPrice, ccy)}
                                    </span>
                                  : <div className="flex items-center justify-end gap-0.5">
                                      <span className="text-gray-400 text-[11px]">$</span>
                                      <input type="number" value={right.unitPrice} min={0} step={0.01}
                                        onChange={e => updateLine(right.id, 'unitPrice', e.target.value)}
                                        className="text-[11px] border border-gray-200 rounded px-1 py-0.5 text-right w-16 focus:outline-none focus:border-blue-400" />
                                    </div>
                                }
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                                {fmtCurrency(lineTotal, ccy)}
                              </td>
                              <td className="py-2 px-1 text-center">
                                <button onClick={() => removeLine(right.id)} className="text-gray-300 hover:text-red-500 transition-colors">×</button>
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-4 py-2 border-l border-gray-200" />
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-4 py-2.5">
                        <div className="flex items-center justify-between px-2 py-1.5 bg-indigo-50 rounded-lg">
                          <div>
                            <span className="text-[10px] font-semibold text-indigo-700">🔷 Selected tier</span>
                            <span className="text-[10px] text-indigo-400 ml-1.5">Highest mapped tier wins</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TIER_COLORS[step2.tier] ?? 'bg-gray-100 text-gray-700'}`}>
                            {platform} {step2.tier}
                          </span>
                        </div>
                      </td>
                      <td colSpan={6} className="px-4 py-2.5 border-l border-gray-200 text-right">
                        <span className="text-xs font-semibold text-gray-500 mr-2">Total</span>
                        <span className="text-sm font-bold text-blue-600">{fmtCurrency(effectiveTotal, ccy)}</span>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100">
                        <td colSpan={3} className="px-4 py-3" />
                        <td colSpan={6} className="px-4 py-3 border-l border-gray-200">
                          <div className="space-y-1.5">
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={addLine}
                                className="text-[11px] px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">
                                + Add Product
                              </button>
                              <button onClick={resetToDefaultMigration}
                                className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                                ↺ Reset to Default Migration
                              </button>
                              <button
                                onClick={resetToOpportunityProducts}
                                disabled={!canResetToOli}
                                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                  canResetToOli
                                    ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                }`}>
                                ↺ Reset to Opportunity Products
                              </button>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                              <input type="checkbox" checked={matchAutoRenewal} onChange={e => setMatchAutoRenewal(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                              Scale sales prices to match auto-renewal — {fmtCurrency(autoRenewalBaseline, ccy)}
                            </label>
                          </div>
                        </td>
                      </tr>
                  </tfoot>
                </table>
              </div>
              {step2.hasManualReview && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  ⚠ Contains &quot;Custom Subscription Fee&quot; — manual review required
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3 — Claims Gap Analysis */}
        <div>
          <button
            onClick={() => setSec3Open(o => !o)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
              claimGaps.length > 0 ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'
            }`}>3</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">Feature Claims</div>
              <div className="text-xs text-gray-400 mt-0.5">Features in use today, checked against the new model</div>
            </div>
            {claimGaps.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {claimGaps.length} gap{claimGaps.length > 1 ? 's' : ''}
              </span>
            )}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              className={`shrink-0 text-gray-400 transition-transform ${sec3Open ? 'rotate-180' : ''}`}>
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {sec3Open && (
            <div className="px-6 pb-5 space-y-2">
              {step5.currentClaims.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No current claims data available.</p>
              ) : (
                <>
                  {claimGaps.length > 0 && (
                    <ClaimsRow color="red" label="Lost Features" count={claimGaps.length} claims={claimGaps} kind="gap" />
                  )}
                  {claimCovered.length > 0 && (
                    <ClaimsRow color="yellow" label="Retained Features" count={claimCovered.length} claims={claimCovered} kind="covered" sunsetCodes={sunsetCodes} />
                  )}
                  {claimGains.length > 0 && (
                    <ClaimsRow color="teal" label="New Features" count={claimGains.length} claims={claimGains} kind="new" />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Section 4 — Opportunity Data */}
        <div className="border-t">
            <button
              onClick={() => setSec4Open(o => !o)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">4</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">Opportunity Data</div>
                <div className="text-xs text-gray-400 mt-0.5">Update fields on the Salesforce opportunity</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                className={`shrink-0 text-gray-400 transition-transform ${sec4Open ? 'rotate-180' : ''}`}>
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {sec4Open && (
              <div className="px-6 pb-5">
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={renewalProductsConfirmed}
                      onChange={e => { setRenewalProductsConfirmed(e.target.checked); setFieldsSaveState('idle'); }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-gray-700">Renewal Products Confirmed</span>
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Order Notes</label>
                    <textarea
                      value={orderNotes}
                      onChange={e => { setOrderNotes(e.target.value); setFieldsSaveState('idle'); }}
                      rows={2}
                      placeholder="Order Notes…"
                      className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveFields}
                      disabled={fieldsSaveState === 'saving'}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        fieldsSaveState === 'saved' ? 'bg-green-100 text-green-700'
                          : fieldsSaveState === 'error' ? 'bg-red-100 text-red-700'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50'
                      }`}
                    >
                      {fieldsSaveState === 'saving' ? 'Updating…' : fieldsSaveState === 'saved' ? '✓ Updated' : 'Update SF Fields'}
                    </button>
                    {fieldsSaveState === 'error' && <span className="text-[10px] text-red-600">{fieldsSaveError}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* ── Dark footer ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 px-6 pt-4 pb-4 shrink-0">
        {/* Stats row */}
        <div className="flex items-start justify-between gap-4 px-4">
          <FooterStat label="Currency" value={ccy} />
          <FooterStat label="ARR Basis" value={fmtCurrency(data.arrBasis, ccy)} />
          <FooterStat label="Auto Renewal" value={fmtCurrency(autoRenewalBaseline, ccy)} />
          <FooterStat
            label="Migration List Price"
            value={fmtCurrency(listTotal, ccy)}
            delta={listDelta}
            deltaPct={listDeltaPct}
            currency={ccy}
          />
          <FooterStat
            label="Final Migration Price"
            value={fmtCurrency(effectiveTotal, ccy)}
            delta={finalDelta}
            deltaPct={finalDeltaPct}
            currency={ccy}
            highlighted
          />
        </div>
        {/* Buttons row */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-700">
          <ApproveButton
            result={data}
            overrideLines={overrideLines}
            orderNotes={orderNotes}
            renewalProductsConfirmed={renewalProductsConfirmed}
            label="Approve and Update Salesforce"
            onApproved={(id) => {
              const snapshot: ApprovedSnapshot = { lines: editableLines, renewalProductsConfirmed, orderNotes };
              onApproved(id, snapshot);
            }}
          />
          <button onClick={isLast ? onClose : onNext}
            className="px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors flex items-center gap-1">
            {isLast ? 'Close' : 'Next'}
            {!isLast && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" /></svg>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PlatformRow({ label, value, logic }: { label: string; value: string | number; logic?: string }) {
  return (
    <tr>
      <td className="py-1.5 pr-4 font-mono text-gray-500">{label}</td>
      <td className={`py-1.5 pr-4 font-medium ${typeof value === 'string' && value !== '—' ? 'text-gray-900' : 'text-gray-400'}`}>{value}</td>
      <td className="py-1.5">
        {logic
          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{logic}</span>
          : <span className="text-gray-300">—</span>
        }
      </td>
    </tr>
  );
}

function ClaimsRow({ color, label, count, claims, kind, sunsetCodes }: {
  color: 'red' | 'yellow' | 'teal';
  label: string;
  count: number;
  claims: string[];
  kind: 'gap' | 'covered' | 'new';
  sunsetCodes?: Set<string>;
}) {
  const dotColors   = { red: 'bg-red-500', yellow: 'bg-yellow-400', teal: 'bg-teal-500' };
  const rowBg       = { red: 'bg-red-50 border-red-100', yellow: 'bg-yellow-50 border-yellow-100', teal: 'bg-teal-50 border-teal-100' };
  const pillStyle   = {
    gap:     'bg-red-100 text-red-800 border border-red-200',
    covered: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    new:     'bg-teal-100 text-teal-800 border border-teal-200',
  };
  return (
    <div className={`px-3 py-2.5 rounded-lg border ${rowBg[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs font-bold text-gray-500">{count}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {claims.map(c => {
          const isSunset = sunsetCodes?.has(c);
          return isSunset
            ? (
              <span key={c} title={`${getClaimName(c)} — sunsetting`}
                className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 border border-gray-200 line-through">
                {c}
              </span>
            ) : (
              <span key={c} title={getClaimName(c)} className={`text-xs font-mono px-1.5 py-0.5 rounded ${pillStyle[kind]}`}>{c}</span>
            );
        })}
      </div>
    </div>
  );
}

function FooterStat({ label, value, delta, deltaPct, currency, highlighted }: {
  label: string; value: string;
  delta?: number; deltaPct?: number;
  currency?: string;
  highlighted?: boolean;
}) {
  const hasChange = delta != null && deltaPct != null && currency;
  const positive = (delta ?? 0) >= 0;
  const deltaColor = positive ? 'text-green-400' : 'text-red-400';
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-lg font-bold ${highlighted && hasChange ? deltaColor : 'text-white'}`}>
          {value}
        </span>
        {hasChange && delta != null && deltaPct != null && currency && (
          <span className={`text-sm font-medium ${deltaColor}`}>
            {positive ? '+' : ''}{fmtCurrency(delta, currency)}
            <span className="text-xs ml-1 opacity-80">{fmtPct(deltaPct)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
