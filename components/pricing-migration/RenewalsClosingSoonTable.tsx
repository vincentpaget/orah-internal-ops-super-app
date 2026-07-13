'use client';

import { useState, useRef, useEffect } from 'react';
import type { RenewalOpp } from '@/app/api/pricing-migration/renewals-closing-soon/route';

type TileFilter = 'All' | 'Pending Auto-Renewals' | 'Do Not Auto Renew' | 'Renewals In Progress';
type CloseDateFilter = 'All' | 'Next 7 days' | 'Next 30 days' | 'Next 60 days' | 'Next 90 days' | 'Past due';

interface Props {
  opps: RenewalOpp[];
  instanceUrl: string;
}

const TILES: { key: TileFilter; label: string }[] = [
  { key: 'All',                   label: 'All' },
  { key: 'Pending Auto-Renewals', label: 'Pending Auto-Renewals' },
  { key: 'Do Not Auto Renew',     label: 'Do Not Auto Renew' },
  { key: 'Renewals In Progress',  label: 'Renewals In Progress' },
];

function matchTile(opp: RenewalOpp, tile: TileFilter): boolean {
  if (tile === 'All') return true;
  if (tile === 'Pending Auto-Renewals') return opp.stageName === 'Pending' && !opp.doNotAutoRenew;
  if (tile === 'Do Not Auto Renew') return opp.doNotAutoRenew;
  if (tile === 'Renewals In Progress') return opp.stageName !== 'Pending';
  return true;
}

function matchCloseDate(opp: RenewalOpp, filter: CloseDateFilter): boolean {
  if (filter === 'All') return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(opp.closeDate);
  if (filter === 'Past due') return date < today;
  const days = filter === 'Next 7 days' ? 7 : filter === 'Next 30 days' ? 30 : filter === 'Next 60 days' ? 60 : 90;
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + days);
  return date >= today && date <= cutoff;
}

function fmtAmt(val: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function fmtAmtNullable(val: number | null | undefined, currency: string): string {
  if (val == null) return '—';
  return fmtAmt(val, currency);
}

// Group by a string key, accumulate count + ARR + auto-renewal
function groupBy(opps: RenewalOpp[], key: (o: RenewalOpp) => string) {
  const map = new Map<string, { count: number; arr: number; autoRenewal: number }>();
  for (const opp of opps) {
    const k = key(opp) || '—';
    const existing = map.get(k) ?? { count: 0, arr: 0, autoRenewal: 0 };
    map.set(k, {
      count: existing.count + 1,
      arr: existing.arr + (opp.arrBasis ?? 0),
      autoRenewal: existing.autoRenewal + (opp.autoRenewalAmount ?? 0),
    });
  }
  return map;
}

// Pick a single representative currency for a group (most common, fallback USD)
function dominantCurrency(opps: RenewalOpp[], filter: (o: RenewalOpp) => boolean): string {
  const counts: Record<string, number> = {};
  for (const o of opps) {
    if (filter(o)) counts[o.currency] = (counts[o.currency] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD';
}

export default function RenewalsClosingSoonTable({ opps, instanceUrl }: Props) {
  const [tile, setTile] = useState<TileFilter>('All');
  const [closeDateFilter, setCloseDateFilter] = useState<CloseDateFilter>('All');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const stagePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (stagePickerRef.current && !stagePickerRef.current.contains(e.target as Node)) {
        setStagePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const allStages = [...new Set(opps.map(o => o.stageName).filter(Boolean))].sort();

  const filtered = opps.filter(opp => {
    if (!matchTile(opp, tile)) return false;
    if (!matchCloseDate(opp, closeDateFilter)) return false;
    if (selectedStages.size > 0 && !selectedStages.has(opp.stageName)) return false;
    return true;
  });

  // Sort locked: close date descending (newest first)
  const sorted = [...filtered].sort((a, b) => b.closeDate.localeCompare(a.closeDate));

  // --- Widget data ---
  const baseCurrency = dominantCurrency(filtered, () => true) || 'USD';

  // Per-rep breakdown
  const repGroups = groupBy(filtered, o => o.ownerName);
  const repRows = [...repGroups.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  // Stage breakdown
  const stageGroups = groupBy(filtered, o => o.stageName);
  const stageRows = [...stageGroups.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  const sfUrl = (id: string) => instanceUrl ? `${instanceUrl}/${id}` : null;

  return (
    <div>
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TILES.map(t => {
          const count = opps.filter(o => matchTile(o, t.key)).length;
          const active = tile === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTile(t.key)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {t.label} <span className={`ml-1 text-xs ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
            </button>
          );
        })}

        {/* Close date filter */}
        <select
          value={closeDateFilter}
          onChange={e => setCloseDateFilter(e.target.value as CloseDateFilter)}
          className="ml-auto px-2.5 py-1 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="All">All Close Dates</option>
          <option value="Past due">Past due</option>
          <option value="Next 7 days">Next 7 days</option>
          <option value="Next 30 days">Next 30 days</option>
          <option value="Next 60 days">Next 60 days</option>
          <option value="Next 90 days">Next 90 days</option>
        </select>

        {/* Stage multi-select */}
        {allStages.length > 0 && (
          <div ref={stagePickerRef} className="relative">
            <button
              onClick={() => setStagePickerOpen(o => !o)}
              className={`px-2.5 py-1 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors ${
                selectedStages.size > 0 ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {selectedStages.size === 0 ? 'All Stages' : `${selectedStages.size} stage${selectedStages.size > 1 ? 's' : ''} selected`}
              {' '}▾
            </button>
            {stagePickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                <button onClick={() => setSelectedStages(new Set())} className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-gray-50">
                  Clear selection
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  {allStages.map(s => (
                    <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedStages.has(s)}
                        onChange={() => setSelectedStages(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-300" />
                      <span className="text-sm text-gray-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side-by-side widgets */}
      <div className="grid grid-cols-2 gap-4 mb-5">

        {/* Per Rep breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per Rep</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Rep</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Count</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">ARR Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {repRows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-gray-400">No data</td></tr>
              )}
              {repRows.map(([rep, { count, arr }]) => (
                <tr key={rep} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800">{rep}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm text-gray-700">{count}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-600">{fmtAmt(arr, baseCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stage breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline Stage</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Stage</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Count</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">ARR Basis</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Auto-Renewal Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stageRows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400">No data</td></tr>
              )}
              {stageRows.map(([stage, { count, arr, autoRenewal }]) => (
                <tr key={stage} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800">{stage}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm text-gray-700">{count}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-600">{fmtAmt(arr, baseCurrency)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-600">{fmtAmt(autoRenewal, baseCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record count */}
      <div className="text-xs text-gray-400 mb-2">{filtered.length} records</div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Opportunity</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Account</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Owner</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Stage</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Close Date ↓</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Renewal Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Do Not Auto Renew</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">CCY</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">ARR Basis</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">Auto-Renewal Amt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-gray-400 text-sm">
                  No records match the current filters
                </td>
              </tr>
            )}
            {sorted.map(opp => {
              const url = sfUrl(opp.id);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isPastDue = new Date(opp.closeDate) < today;

              return (
                <tr key={opp.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-1.5">
                      <div className="font-medium text-gray-900 max-w-[180px] truncate text-sm">{opp.name}</div>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="mt-0.5 shrink-0 text-gray-300 hover:text-blue-500 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
                            <path d="M8 1h3v3M11 1 6 6" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[140px] truncate">{opp.accountName || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{opp.ownerName || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{opp.stageName}</td>
                  <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${isPastDue ? 'text-red-600' : 'text-gray-700'}`}>
                    {opp.closeDate}{isPastDue && <span className="ml-1 text-red-400">overdue</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{opp.renewalDate ?? '—'}</td>
                  <td className="px-3 py-2">
                    {opp.doNotAutoRenew ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">Yes</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{opp.currency}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700 tabular-nums">{fmtAmtNullable(opp.arrBasis, opp.currency)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700 tabular-nums">{fmtAmtNullable(opp.autoRenewalAmount, opp.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
