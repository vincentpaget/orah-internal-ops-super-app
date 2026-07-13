'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

const CACHE_KEY = 'accounts_cache';

interface AccountsCache {
  accounts: AccountRow[];
  instanceUrl: string;
  loadedAt: number; // ms epoch
}

interface AccountRow {
  id: string;
  name: string;
  billingCountry: string | null;
  currency: string;
  contractStatus: string | null;
  renewalDate: string | null;
  successOwner: string | null;
  totalHomeCARR: number | null;
  totalLocalCARR: number | null;
  managedAccounts: number | null;
  lastPricebookName: string | null;
  openOpps: number | null;
  migrationStatus: 'Migrated' | 'In Progress' | 'Pending' | 'Not Applicable';
}

type MigrationFilter = 'All' | 'Migrated' | 'In Progress' | 'Pending' | 'Not Applicable';
type SortKey =
  | 'name' | 'billingCountry' | 'successOwner' | 'contractStatus' | 'renewalDate'
  | 'totalHomeCARR' | 'totalLocalCARR' | 'managedAccounts' | 'openOpps' | 'migrationStatus';
type SortDir = 'asc' | 'desc';

function fmtCARR(value: number | null, currency: string) {
  if (value == null) return '—';
  return `${Math.round(value).toLocaleString('en-US')} (${currency})`;
}

function contractStatusColor(status: string | null): string {
  if (!status) return 'bg-gray-100 text-gray-500 border-gray-200';
  const l = status.toLowerCase();
  if (l.includes('cancel')) return 'bg-red-100 text-red-700 border-red-200';
  if (l === 'active')       return 'bg-green-100 text-green-700 border-green-300';
  if (l === 'upcoming')     return 'bg-blue-100 text-blue-700 border-blue-200';
  if (l === 'expired')      return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

const MIGRATION_STATUS_COLORS: Record<string, string> = {
  'Migrated':       'bg-green-100 text-green-700 border-green-300',
  'In Progress':    'bg-blue-100 text-blue-700 border-blue-200',
  'Pending':        'bg-amber-100 text-amber-700 border-amber-200',
  'Not Applicable': 'bg-gray-100 text-gray-500 border-gray-200',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${colorClass}`}>
      {label}
    </span>
  );
}

function SummaryStrip({ accounts }: { accounts: AccountRow[] }) {
  // Exclude "Not Applicable" (cancelled) from migration progress denominators
  const active      = accounts.filter(a => a.migrationStatus !== 'Not Applicable');
  const total       = active.length;
  const migrated    = active.filter(a => a.migrationStatus === 'Migrated').length;
  const inProgress  = active.filter(a => a.migrationStatus === 'In Progress').length;
  const pending     = active.filter(a => a.migrationStatus === 'Pending').length;
  const notApplicable = accounts.length - total;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const migratedPct   = pct(migrated);
  const inProgressPct = pct(inProgress);
  const pendingPct    = pct(pending);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Migrated</span>
            <span className="text-xs text-green-600 font-bold">{migratedPct}%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{migrated}</div>
          <div className="text-xs text-gray-500 mt-0.5">of {total} active accounts</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">In Progress</span>
            <span className="text-xs text-blue-600 font-bold">{inProgressPct}%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{inProgress}</div>
          <div className="text-xs text-gray-500 mt-0.5">open renewal opp</div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending</span>
            <span className="text-xs text-amber-600 font-bold">{pendingPct}%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{pending}</div>
          <div className="text-xs text-gray-500 mt-0.5">no open opp yet</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Not Applicable</span>
          </div>
          <div className="text-2xl font-bold text-gray-400">{notApplicable}</div>
          <div className="text-xs text-gray-400 mt-0.5">cancelled — no migration needed</div>
        </div>
      </div>
      {total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
          {migratedPct > 0   && <div className="bg-green-400 transition-all" style={{ width: `${migratedPct}%` }} />}
          {inProgressPct > 0 && <div className="bg-blue-400 transition-all"  style={{ width: `${inProgressPct}%` }} />}
          {pendingPct > 0    && <div className="bg-amber-400 transition-all" style={{ width: `${pendingPct}%` }} />}
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts]       = useState<AccountRow[]>([]);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loadedAt, setLoadedAt]       = useState<number | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache: AccountsCache = JSON.parse(raw);
        setAccounts(cache.accounts);
        setInstanceUrl(cache.instanceUrl);
        setLoadedAt(cache.loadedAt);
      }
    } catch { /* ignore corrupt cache */ }
  }, []);

  const [search, setSearch]                     = useState('');
  const [migrationFilter, setMigrationFilter]   = useState<MigrationFilter>('All');
  const [contractFilter, setContractFilter]     = useState('All');
  const [ownerFilter, setOwnerFilter]           = useState('All');
  const [managedFilter, setManagedFilter]       = useState(false);
  const [oppsFilter, setOppsFilter]             = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('renewalDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pricing-migration/accounts');
      if (res.status === 401) { window.location.href = '/login?error=no_session'; return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return; }
      const rows = data.accounts ?? [];
      const url  = data.instanceUrl ?? '';
      const now  = Date.now();
      setAccounts(rows);
      if (url) setInstanceUrl(url);
      setLoadedAt(now);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ accounts: rows, instanceUrl: url, loadedAt: now } satisfies AccountsCache));
      } catch { /* storage full — not a blocker */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  // Contract status values + counts derived from actual data
  const contractStatusOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of accounts) {
      const s = a.contractStatus ?? 'Unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    const statuses = Object.keys(counts).sort();
    return [
      { label: `All (${accounts.length})`, value: 'All' },
      ...statuses.map(s => ({ label: `${s} (${counts[s]})`, value: s })),
    ];
  }, [accounts]);

  const owners = useMemo(() => {
    const set = new Set(accounts.map(a => a.successOwner ?? 'Unassigned'));
    return ['All', ...Array.from(set).sort()];
  }, [accounts]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    return accounts
      .filter(a => {
        if (migrationFilter !== 'All' && a.migrationStatus !== migrationFilter) return false;
        if (contractFilter !== 'All' && a.contractStatus !== contractFilter) return false;
        if (ownerFilter !== 'All' && (a.successOwner ?? 'Unassigned') !== ownerFilter) return false;
        if (managedFilter && !((a.managedAccounts ?? 0) > 1)) return false;
        if (oppsFilter && !((a.openOpps ?? 0) > 1)) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'name':            cmp = a.name.localeCompare(b.name); break;
          case 'billingCountry':  cmp = (a.billingCountry ?? '').localeCompare(b.billingCountry ?? ''); break;
          case 'successOwner':    cmp = (a.successOwner ?? '').localeCompare(b.successOwner ?? ''); break;
          case 'contractStatus':  cmp = (a.contractStatus ?? '').localeCompare(b.contractStatus ?? ''); break;
          case 'renewalDate':     cmp = (a.renewalDate ?? '').localeCompare(b.renewalDate ?? ''); break;
          case 'totalHomeCARR':   cmp = (a.totalHomeCARR ?? -Infinity) - (b.totalHomeCARR ?? -Infinity); break;
          case 'totalLocalCARR':  cmp = (a.totalLocalCARR ?? -Infinity) - (b.totalLocalCARR ?? -Infinity); break;
          case 'managedAccounts': cmp = (a.managedAccounts ?? -Infinity) - (b.managedAccounts ?? -Infinity); break;
          case 'openOpps':        cmp = (a.openOpps ?? -Infinity) - (b.openOpps ?? -Infinity); break;
          case 'migrationStatus': cmp = a.migrationStatus.localeCompare(b.migrationStatus); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [accounts, migrationFilter, contractFilter, ownerFilter, managedFilter, oppsFilter, search, sortKey, sortDir]);

  function SortArrow({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const hasData = accounts.length > 0;

  return (
    <div className="px-8 py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Account Migration Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customer-level view of pricing migration progress</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button onClick={loadAccounts} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
            {loading ? 'Loading…' : hasData ? 'Refresh' : 'Load Accounts'}
          </button>
          {loadedAt && !loading && (
            <span className="text-xs text-gray-400">
              Loaded {new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Fetching accounts from Salesforce…</p>
          </div>
        </div>
      )}

      {!loading && !hasData && !error && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No data loaded</p>
          <p className="text-sm mt-1">Click &ldquo;Load Accounts&rdquo; to fetch from Salesforce</p>
        </div>
      )}

      {!loading && hasData && (
        <>
          <SummaryStrip accounts={accounts} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" placeholder="Search account…" value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-44" />

            {/* Contract status — pills with counts */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
              {contractStatusOptions.map(({ label, value }) => (
                <button key={value} onClick={() => setContractFilter(value)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${contractFilter === value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Migration status — dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Status:</span>
              <select value={migrationFilter} onChange={e => setMigrationFilter(e.target.value as MigrationFilter)}
                className="text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer">
                {(['All', 'Migrated', 'In Progress', 'Pending', 'Not Applicable'] as MigrationFilter[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Owner filter */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Owner:</span>
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                className="text-xs text-gray-700 bg-transparent border-none outline-none max-w-40 cursor-pointer">
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Managed >1 toggle */}
            <button onClick={() => setManagedFilter(v => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                managedFilter ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}>
              Managed &gt;1
            </button>

            {/* Open opps >1 toggle */}
            <button onClick={() => setOppsFilter(v => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                oppsFilter ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}>
              Opps &gt;1
            </button>

            <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {accounts.length}</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse" style={{ minWidth: '1400px' }}>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 sticky left-0 bg-gray-50 z-20 w-64 shadow-[1px_0_0_#e5e7eb]">
                      <button onClick={() => toggleSort('name')} className="flex items-center hover:text-gray-700 whitespace-nowrap">
                        Account Name <SortArrow k="name" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">
                      <button onClick={() => toggleSort('billingCountry')} className="flex items-center hover:text-gray-700 whitespace-nowrap">
                        Country <SortArrow k="billingCountry" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-36">
                      <button onClick={() => toggleSort('successOwner')} className="flex items-center hover:text-gray-700 whitespace-nowrap">
                        Success Owner <SortArrow k="successOwner" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-32">
                      <button onClick={() => toggleSort('contractStatus')} className="flex items-center hover:text-gray-700 whitespace-nowrap">
                        Contract Status <SortArrow k="contractStatus" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">
                      <button onClick={() => toggleSort('renewalDate')} className="flex items-center hover:text-gray-700 whitespace-nowrap">
                        Renewal Date <SortArrow k="renewalDate" />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 w-40">
                      <button onClick={() => toggleSort('totalHomeCARR')} className="flex items-center ml-auto hover:text-gray-700 whitespace-nowrap">
                        Home CARR <SortArrow k="totalHomeCARR" />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 w-40">
                      <button onClick={() => toggleSort('totalLocalCARR')} className="flex items-center ml-auto hover:text-gray-700 whitespace-nowrap">
                        Local CARR <SortArrow k="totalLocalCARR" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 w-24">
                      <button onClick={() => toggleSort('managedAccounts')} className="flex items-center mx-auto hover:text-gray-700 whitespace-nowrap">
                        Managed <SortArrow k="managedAccounts" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-48">Last Pricebook</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 w-24">
                      <button onClick={() => toggleSort('openOpps')} className="flex items-center mx-auto hover:text-gray-700 whitespace-nowrap">
                        Open Opps <SortArrow k="openOpps" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 w-28">
                      <button onClick={() => toggleSort('migrationStatus')} className="flex items-center mx-auto hover:text-gray-700 whitespace-nowrap">
                        Status <SortArrow k="migrationStatus" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const managedHighlight = (row.managedAccounts ?? 0) > 1;
                    const oppsHighlight    = (row.openOpps ?? 0) > 1;
                    return (
                      <tr key={row.id} className="border-t border-gray-100 hover:bg-blue-50/20 transition-colors">
                        <td className="px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white z-10 shadow-[1px_0_0_#e5e7eb] w-64">
                          <Link href={`/pricing-migration/accounts/${row.id}`}
                            className="block truncate max-w-60 text-xs font-medium hover:text-blue-600 transition-colors">
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.billingCountry ?? '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.successOwner ?? '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {row.contractStatus
                            ? <Badge label={row.contractStatus} colorClass={contractStatusColor(row.contractStatus)} />
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{row.renewalDate ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                          {fmtCARR(row.totalHomeCARR, 'NZD')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                          {fmtCARR(row.totalLocalCARR, row.currency || 'USD')}
                        </td>
                        {/* Managed — highlight orange if > 1 */}
                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                          {managedHighlight ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-100 text-orange-700 border-orange-200">
                              {row.managedAccounts}
                            </span>
                          ) : (
                            <span className="text-gray-600">{row.managedAccounts ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 w-48">
                          <span className="block truncate max-w-44" title={row.lastPricebookName ?? undefined}>
                            {row.lastPricebookName ?? <span className="text-gray-400">—</span>}
                          </span>
                        </td>
                        {/* Open Opps — highlight orange if > 1 */}
                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                          {oppsHighlight ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-100 text-orange-700 border-orange-200">
                              {row.openOpps}
                            </span>
                          ) : (
                            <span className="text-gray-600">{row.openOpps ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                          <Badge label={row.migrationStatus} colorClass={MIGRATION_STATUS_COLORS[row.migrationStatus]} />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                        No accounts match the current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
