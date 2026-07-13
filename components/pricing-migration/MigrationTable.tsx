'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { MigrationResult } from '@/lib/pricing-migration/migration/types';
import MigrationModal, { type ModalEntry, type ApprovedSnapshot } from './MigrationModal';

interface ErrorRow {
  opportunityId: string;
  opportunityName: string;
  error: string;
}

export interface OliLine {
  productName: string;
  product2Id: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  dbAccountExtId: string | null;
}

export interface AlreadyUpdatedRow {
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
  doNotAutoRenew: boolean | null;
  autoRenewalAmount: number | null;
  platform: 'Supervise' | 'Boarding';
  alreadyUpdated: true;
  renewalProductsConfirmed: boolean | null;
  currentOlis: OliLine[];
  migrationResult: MigrationResult | null;
}

type Row = MigrationResult | ErrorRow;

type RenderRow =
  | { kind: 'result';   data: MigrationResult }
  | { kind: 'error';    data: ErrorRow }
  | { kind: 'updated';  data: AlreadyUpdatedRow }
  | { kind: 'approved'; data: MigrationResult };

type RowStatus = 'todo' | 'in-progress' | 'done' | 'error';
type TabValue = 'all' | RowStatus;

type SortKey = 'opportunityName' | 'pricebook' | 'closeDate' | 'stage' | 'status' | 'flagCount';
type FlagFilter = 'all' | 'has-flags' | 'no-flags';

interface FlagItem { label: string; color: 'red' | 'amber' | 'purple' | 'orange' }

interface Props {
  results: Row[];
  updatedOpps: AlreadyUpdatedRow[];
  instanceUrl: string;
  pricebookNames: Record<string, string | null>;
  sessionApprovedIds: Set<string>;
  sessionConfirmedIds: Set<string>;
  onApproved: (opportunityId: string, confirmed: boolean) => void;
}

function isError(row: Row): row is ErrorRow {
  return 'error' in row;
}

function rowId(row: RenderRow): string {
  return row.data.opportunityId;
}

function deriveStatus(row: RenderRow, confirmedIds: Set<string>): RowStatus {
  if (row.kind === 'error') return 'error';
  if (row.kind === 'result') return 'todo';
  const id = row.data.opportunityId;
  const confirmed = confirmedIds.has(id) || row.data.renewalProductsConfirmed === true;
  if (row.kind === 'approved') return confirmed ? 'done' : 'in-progress';
  return confirmed ? 'done' : 'in-progress';
}

function fmtNum(n: number | null): string {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function derivePricebook(row: RenderRow): string {
  if (row.kind === 'error' || row.kind === 'result') return 'Legacy';
  if (row.kind === 'approved') return row.data.step1.platform;
  return row.data.platform;
}

function deriveFlags(row: RenderRow): FlagItem[] {
  if (row.kind === 'error') return [];
  const mr: MigrationResult | null =
    row.kind === 'result' || row.kind === 'approved' ? row.data : row.data.migrationResult;
  if (!mr) return [];

  const flags: FlagItem[] = [];
  if (mr.step5.claimsGap.gaps.length > 0)
    flags.push({ label: 'Feature gaps', color: 'red' });
  if (mr.step6.delta < 0)
    flags.push({ label: 'Price < renewal', color: 'amber' });
  if (mr.multipleDbAccounts)
    flags.push({ label: 'Multiple DB accounts', color: 'purple' });
  if (mr.step2.hasManualReview)
    flags.push({ label: 'Custom products', color: 'orange' });
  return flags;
}

function tabLabel(tab: TabValue): string {
  if (tab === 'all')         return 'All';
  if (tab === 'todo')        return 'To Do';
  if (tab === 'in-progress') return 'In Progress';
  if (tab === 'done')        return 'Done';
  return 'Error';
}

function sortValue(row: RenderRow, key: SortKey, confirmedIds: Set<string>): string | number {
  if (key === 'opportunityName') return row.data.opportunityName;
  if (key === 'pricebook') return derivePricebook(row);
  if (key === 'status') {
    const order: Record<RowStatus, number> = { todo: 0, 'in-progress': 1, done: 2, error: 3 };
    return order[deriveStatus(row, confirmedIds)];
  }
  if (key === 'flagCount') return deriveFlags(row).length;
  if (row.kind === 'error') return '';
  if (key === 'closeDate') return row.data.closeDate ?? '';
  if (key === 'stage') return row.kind === 'updated' ? (row.data.stageName ?? '') : row.data.stageName ?? '';
  return '';
}

export default function MigrationTable({ results, updatedOpps, instanceUrl, pricebookNames, sessionApprovedIds, sessionConfirmedIds, onApproved }: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const stagePickerRef = useRef<HTMLDivElement>(null);
  const [closeDateFilter, setCloseDateFilter] = useState<'All' | 'Next 7 days' | 'Next 30 days' | 'Next 60 days' | 'Next 90 days' | 'Past due'>('All');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedNoDataOpp, setSelectedNoDataOpp] = useState<{ opportunityId: string; opportunityName: string; closeDate: string | null } | null>(null);
  const [approvedSnapshots, setApprovedSnapshots] = useState<Record<string, ApprovedSnapshot>>({});
  const [sortKey, setSortKey] = useState<SortKey>('closeDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (stagePickerRef.current && !stagePickerRef.current.contains(e.target as Node)) setStagePickerOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const allRows: RenderRow[] = [
    ...results.map((r): RenderRow => {
      if (isError(r)) return { kind: 'error', data: r };
      const mr = r as MigrationResult;
      return sessionApprovedIds.has(mr.opportunityId)
        ? { kind: 'approved', data: mr }
        : { kind: 'result', data: mr };
    }),
    ...updatedOpps.map((u): RenderRow => {
      if (sessionApprovedIds.has(u.opportunityId) && u.migrationResult) {
        return { kind: 'approved', data: u.migrationResult };
      }
      return { kind: 'updated', data: u };
    }),
  ];

  const STAGE_ORDER = ['Pending', 'Qualifying', 'Evaluation', 'Proposal', 'Negotiation', 'Closing'];
  const allStages = [...new Set(
    allRows
      .map(r => r.kind === 'error' ? null : r.data.stageName)
      .filter((s): s is string => s != null)
  )].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a);
    const bi = STAGE_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const filteredByNonTab = allRows.filter(row => matchStage(row) && matchCloseDate(row) && matchFlagCount(row) && matchSearch(row));

  const counts: Record<TabValue, number> = {
    all:           filteredByNonTab.length,
    todo:          filteredByNonTab.filter(r => deriveStatus(r, sessionConfirmedIds) === 'todo').length,
    'in-progress': filteredByNonTab.filter(r => deriveStatus(r, sessionConfirmedIds) === 'in-progress').length,
    done:          filteredByNonTab.filter(r => deriveStatus(r, sessionConfirmedIds) === 'done').length,
    error:         filteredByNonTab.filter(r => deriveStatus(r, sessionConfirmedIds) === 'error').length,
  };

  function matchTab(row: RenderRow): boolean {
    if (activeTab === 'all') return true;
    return deriveStatus(row, sessionConfirmedIds) === activeTab;
  }

  function matchStage(row: RenderRow): boolean {
    if (selectedStages.size === 0) return true;
    if (row.kind === 'error') return false;
    const stage = row.kind === 'updated' ? row.data.stageName : row.data.stageName;
    return stage != null && selectedStages.has(stage);
  }

  function matchCloseDate(row: RenderRow): boolean {
    if (closeDateFilter === 'All') return true;
    const closeDate = row.kind === 'error' ? null : row.data.closeDate;
    if (!closeDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const date = new Date(closeDate);
    if (closeDateFilter === 'Past due') return date < today;
    const days = closeDateFilter === 'Next 7 days' ? 7 : closeDateFilter === 'Next 30 days' ? 30 : closeDateFilter === 'Next 60 days' ? 60 : 90;
    const cutoff = new Date(today); cutoff.setDate(today.getDate() + days);
    return date >= today && date <= cutoff;
  }

  function matchFlagCount(row: RenderRow): boolean {
    if (flagFilter === 'all') return true;
    const count = deriveFlags(row).length;
    return flagFilter === 'has-flags' ? count > 0 : count === 0;
  }

  function matchSearch(row: RenderRow): boolean {
    if (!searchQuery.trim()) return true;
    return row.data.opportunityName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  }

  const filtered = allRows.filter(row => matchTab(row) && matchStage(row) && matchCloseDate(row) && matchFlagCount(row) && matchSearch(row));

  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey, sessionConfirmedIds);
    const bv = sortValue(b, sortKey, sessionConfirmedIds);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const entries = useMemo((): ModalEntry[] => {
    return sorted.flatMap((r): ModalEntry[] => {
      if (r.kind === 'error') return [];
      if (r.kind === 'result') return [{ kind: 'pending', data: r.data }];
      if (r.kind === 'approved') return [{ kind: 'approved', data: r.data }];
      if (!r.data.migrationResult) return [];
      return [{ kind: 'migrated', data: r.data.migrationResult, currentOlis: r.data.currentOlis }];
    });
  }, [sorted]);

  function openRow(opportunityId: string) {
    const idx = entries.findIndex(e => e.data.opportunityId === opportunityId);
    if (idx >= 0) {
      setSelectedIndex(idx);
      return;
    }
    // Updated row with no migration data — open simplified panel
    const row = sorted.find(r => rowId(r) === opportunityId);
    if (row?.kind === 'updated') {
      setSelectedNoDataOpp({
        opportunityId: row.data.opportunityId,
        opportunityName: row.data.opportunityName,
        closeDate: row.data.closeDate,
      });
    }
  }

  const sfUrl = (id: string) => instanceUrl ? `${instanceUrl}/${id}` : null;

  const tabs: TabValue[] = counts.error > 0
    ? ['all', 'todo', 'in-progress', 'done', 'error']
    : ['all', 'todo', 'in-progress', 'done'];

  return (
    <div>
      {/* Status tabs */}
      <div className="flex border-b border-gray-200 mb-0">
        {tabs.map(tab => {
          const active = activeTab === tab;
          const dotColors: Record<TabValue, string> = {
            all: 'bg-gray-400', todo: 'bg-gray-400', 'in-progress': 'bg-blue-500', done: 'bg-green-500', error: 'bg-red-500',
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab !== 'all' && <span className={`w-2 h-2 rounded-full ${dotColors[tab]}`} />}
              {tabLabel(tab)}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 py-3">
        {allStages.length > 0 && (
          <div ref={stagePickerRef} className="relative">
            <button
              onClick={() => setStagePickerOpen(o => !o)}
              className={`px-2.5 py-1 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors ${
                selectedStages.size > 0 ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {selectedStages.size === 0 ? 'All Stages' : `${selectedStages.size} stage${selectedStages.size > 1 ? 's' : ''} selected`}{' '}▾
            </button>
            {stagePickerOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                <button onClick={() => setSelectedStages(new Set())} className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-gray-50">Clear selection</button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  {allStages.map(s => (
                    <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedStages.has(s)}
                        onChange={() => setSelectedStages(prev => { const next = new Set(prev); next.has(s) ? next.delete(s) : next.add(s); return next; })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-300" />
                      <span className="text-sm text-gray-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <select
          value={closeDateFilter}
          onChange={e => setCloseDateFilter(e.target.value as typeof closeDateFilter)}
          className="px-2.5 py-1 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="All">All Close Dates</option>
          <option value="Past due">Past due</option>
          <option value="Next 7 days">Next 7 days</option>
          <option value="Next 30 days">Next 30 days</option>
          <option value="Next 60 days">Next 60 days</option>
          <option value="Next 90 days">Next 90 days</option>
        </select>

        <select
          value={flagFilter}
          onChange={e => setFlagFilter(e.target.value as FlagFilter)}
          className={`px-2.5 py-1 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors ${
            flagFilter !== 'all' ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          <option value="all">All Flags</option>
          <option value="has-flags">Has Flags</option>
          <option value="no-flags">No Flags</option>
        </select>

        {sorted.length < allRows.length && (
          <span className="text-xs text-gray-400 ml-1">{sorted.length} of {allRows.length} shown</span>
        )}

        <div className="ml-auto flex items-center relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search opportunities…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-max w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh label="Opportunity"    col="opportunityName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 w-[240px]" />
              <SortTh label="Pricebook"      col="pricebook"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">CCY</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Managed Accts</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">ARR Basis</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Booked ARR</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Net ARR</th>
              <SortTh label="Close Date"     col="closeDate"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Stage"          col="stage"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">No Auto Renew</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">Type</th>
              <SortTh label="Status"         col="status"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Flags"          col="flagCount"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[280px]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row, i) => {
              const id = rowId(row);
              const url = sfUrl(id);
              const status = deriveStatus(row, sessionConfirmedIds);
              const flags = deriveFlags(row);
              const isNavigable = row.kind !== 'error';
              const closeDate = row.kind === 'error' ? null : row.data.closeDate;
              const stageName = row.kind === 'error' ? null : row.data.stageName;
              const pricebookName = row.kind === 'approved'
                ? derivePricebook(row)
                : (pricebookNames[id] ?? null);
              const rowData = row.kind !== 'error' ? row.data : null;
              const currency = rowData?.currency ?? null;
              const managedAccounts = rowData?.managedAccounts ?? null;
              const arrBasis = rowData?.arrBasis ?? null;
              const bookedArr = rowData?.bookedArr ?? null;
              const netArr = rowData?.netArr ?? null;
              const type = rowData?.type ?? null;
              const doNotAutoRenew = rowData?.doNotAutoRenew ?? null;
              const stickyBg = status === 'error'
                ? 'bg-red-50/40'
                : isNavigable
                  ? 'bg-white group-hover:bg-blue-50/60'
                  : 'bg-white group-hover:bg-gray-50';

              return (
                <tr
                  key={i}
                  className={`group transition-colors ${
                    isNavigable ? 'cursor-pointer hover:bg-blue-50/60' : 'hover:bg-gray-50'
                  } ${status === 'error' ? 'bg-red-50/40' : ''}`}
                  onClick={() => isNavigable && openRow(id)}
                >
                  <td className={`px-3 py-3 sticky left-0 z-10 border-r border-gray-200 ${stickyBg}`}>
                    <OpportunityCell name={row.data.opportunityName} sfUrl={url} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <PricebookBadge name={pricebookName} />
                  </td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs font-mono">{currency ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm text-right">{fmtNum(managedAccounts)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm text-right">{fmtNum(arrBasis)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm text-right">{fmtNum(bookedArr)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm text-right">{fmtNum(netArr)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm">{closeDate ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm">{stageName ?? '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {doNotAutoRenew
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Yes</span>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-sm">{type ?? '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-3 py-3">
                    {row.kind === 'error' ? (
                      <span className="text-red-600 text-xs truncate max-w-[260px] block">{row.data.error}</span>
                    ) : flags.length === 0 ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {flags.map(f => <FlagChip key={f.label} flag={f} />)}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No opportunities match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedIndex !== null && entries.length > 0 && (
        <MigrationModal
          entries={entries}
          initialIndex={selectedIndex}
          instanceUrl={instanceUrl}
          approvedSnapshots={approvedSnapshots}
          onClose={() => setSelectedIndex(null)}
          onApproved={(id, confirmed, snapshot) => {
            setApprovedSnapshots(prev => ({ ...prev, [id]: snapshot }));
            onApproved(id, confirmed);
          }}
          onReviewed={(id) => { onApproved(id, false); }}
        />
      )}

      {selectedNoDataOpp && (
        <NoDataModal
          opp={selectedNoDataOpp}
          sfUrl={sfUrl(selectedNoDataOpp.opportunityId)}
          onClose={() => setSelectedNoDataOpp(null)}
        />
      )}
    </div>
  );
}

// ── No-data modal (for updated rows missing migration engine output) ──────────

function NoDataModal({ opp, sfUrl, onClose }: {
  opp: { opportunityId: string; opportunityName: string; closeDate: string | null };
  sfUrl: string | null;
  onClose: () => void;
}) {
  const [renewalProductsConfirmed, setRenewalProductsConfirmed] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  async function saveFields() {
    setSaveState('saving');
    try {
      const res = await fetch('/api/pricing-migration/migration/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opp.opportunityId, renewalProductsConfirmed, orderNotes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Unknown error');
      }
      setSaveState('saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaveState('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{opp.opportunityName}</div>
            {opp.closeDate && <div className="text-xs text-gray-400 mt-0.5">Close: {opp.closeDate}</div>}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {sfUrl && (
              <a href={sfUrl} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Open in Salesforce">
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
                  <path d="M8 1h3v3M11 1 6 6" />
                </svg>
              </a>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {/* No-data notice */}
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
          <p className="text-sm text-amber-700">
            <span className="font-semibold">No migration analysis available.</span>{' '}
            This opportunity&apos;s line items are missing DB Account linkage — migration engine could not run.
          </p>
        </div>

        {/* Opportunity Data */}
        <div className="px-6 py-5 space-y-4">
          <div className="text-sm font-semibold text-gray-900">Opportunity Data</div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={renewalProductsConfirmed} onChange={e => setRenewalProductsConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700">Renewal Products Confirmed</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Order Notes</label>
            <textarea
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              rows={3}
              placeholder="Enter order notes…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {saveState === 'saved' && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
            {saveState === 'error' && <span className="text-xs text-red-600">{saveError}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Close
            </button>
            <button
              onClick={saveFields}
              disabled={saveState === 'saving'}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveState === 'saving' ? 'Saving…' : 'Update SF Fields'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OpportunityCell({ name, sfUrl }: { name: string; sfUrl: string | null }) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="font-medium text-gray-900 truncate max-w-[300px]">{name}</div>
      {sfUrl && (
        <a href={sfUrl} target="_blank" rel="noopener noreferrer" title="Open in Salesforce"
          onClick={e => e.stopPropagation()}
          className="mt-0.5 shrink-0 text-gray-300 hover:text-blue-500 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
            <path d="M8 1h3v3M11 1 6 6" />
          </svg>
        </a>
      )}
    </div>
  );
}

function SortTh({ label, col, sortKey, sortDir, onSort, className }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = sortKey === col;
  return (
    <th className={`px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900 group ${className ?? ''}`}
      onClick={() => onSort(col)}>
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {active && sortDir === 'desc' ? '↓' : '↑'}
        </span>
      </span>
    </th>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  const styles: Record<RowStatus, string> = {
    'todo':        'bg-gray-100 text-gray-600',
    'in-progress': 'bg-blue-100 text-blue-700',
    'done':        'bg-green-100 text-green-700',
    'error':       'bg-red-100 text-red-700',
  };
  const labels: Record<RowStatus, string> = {
    'todo':        'To Do',
    'in-progress': 'In Progress',
    'done':        'Done',
    'error':       'Error',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PricebookBadge({ name }: { name: string | null }) {
  const lower = (name ?? '').toLowerCase();
  const style = lower.includes('supervise')
    ? 'bg-indigo-100 text-indigo-700'
    : lower.includes('boarding')
      ? 'bg-purple-100 text-purple-700'
      : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {name ?? '—'}
    </span>
  );
}

function FlagChip({ flag }: { flag: FlagItem }) {
  const styles: Record<FlagItem['color'], string> = {
    red:    'bg-red-50 text-red-700 border border-red-200',
    amber:  'bg-amber-50 text-amber-700 border border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${styles[flag.color]}`}>
      {flag.label}
    </span>
  );
}
