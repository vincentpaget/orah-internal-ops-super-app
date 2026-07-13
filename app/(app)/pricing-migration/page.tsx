'use client';

import { useState, useEffect } from 'react';
import MigrationTable from '@/components/pricing-migration/MigrationTable';
import type { MigrationResult } from '@/lib/pricing-migration/migration/types';
import type { AlreadyUpdatedRow } from '@/components/pricing-migration/MigrationTable';

type Row = MigrationResult | { opportunityId: string; opportunityName: string; error: string };

const CACHE_KEY = 'renewal_migration_cache';

interface RenewalCache {
  results: Row[];
  updatedOpps: AlreadyUpdatedRow[];
  instanceUrl: string;
  pricebookNames: Record<string, string | null>;
  loadedAt: number;
}

export default function PricingMigrationPage() {
  const [results, setResults] = useState<Row[]>([]);
  const [updatedOpps, setUpdatedOpps] = useState<AlreadyUpdatedRow[]>([]);
  const [instanceUrl, setInstanceUrl] = useState<string>('');
  const [pricebookNames, setPricebookNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionApprovedIds, setSessionApprovedIds] = useState<Set<string>>(new Set());
  const [sessionConfirmedIds, setSessionConfirmedIds] = useState<Set<string>>(new Set());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [runCloseDateFilter, setRunCloseDateFilter] = useState<'All' | 'Past due' | 'Next 7 days' | 'Next 30 days' | 'Next 60 days' | 'Next 90 days'>('All');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache: RenewalCache = JSON.parse(raw);
        setResults(cache.results);
        setUpdatedOpps(cache.updatedOpps);
        setInstanceUrl(cache.instanceUrl);
        setPricebookNames(cache.pricebookNames ?? {});
        setLoadedAt(cache.loadedAt);
      }
    } catch { /* ignore corrupt cache */ }
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setSessionApprovedIds(new Set());
    setSessionConfirmedIds(new Set());
    try {
      const qs = runCloseDateFilter !== 'All' ? `?closeDate=${encodeURIComponent(runCloseDateFilter)}` : '';
      const res = await fetch(`/api/pricing-migration/migration/run${qs}`);
      if (res.status === 401) {
        window.location.href = '/login?error=no_session';
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Unknown error');
        return;
      }
      const rows    = data.results ?? [];
      const updated = data.updatedOpps ?? [];
      const url     = data.instanceUrl ?? '';
      const pbNames = data.pricebookNames ?? {};
      const now     = Date.now();
      setResults(rows);
      setUpdatedOpps(updated);
      setInstanceUrl(url);
      setPricebookNames(pbNames);
      setLoadedAt(now);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ results: rows, updatedOpps: updated, instanceUrl: url, pricebookNames: pbNames, loadedAt: now } satisfies RenewalCache));
      } catch { /* storage full */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function handleApproved(opportunityId: string, confirmed: boolean) {
    setSessionApprovedIds(prev => new Set([...prev, opportunityId]));
    if (confirmed) setSessionConfirmedIds(prev => new Set([...prev, opportunityId]));
  }

  const hasData = results.length > 0 || updatedOpps.length > 0;

  return (
    <div>
      <div className="px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Renewal Migration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Open renewal opportunities and migration readiness</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <select
              value={runCloseDateFilter}
              onChange={e => setRunCloseDateFilter(e.target.value as typeof runCloseDateFilter)}
              disabled={loading}
              className="px-2.5 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
            >
              <option value="All">All Close Dates</option>
              <option value="Past due">Past due</option>
              <option value="Next 7 days">Next 7 days</option>
              <option value="Next 30 days">Next 30 days</option>
              <option value="Next 60 days">Next 60 days</option>
              <option value="Next 90 days">Next 90 days</option>
            </select>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Running Analysis…' : 'Run Migration Analysis'}
            </button>
          </div>
          {loadedAt && !loading && (
            <span className="text-xs text-gray-400">
              Loaded {new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 pb-8">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p>Fetching opportunities and running migration analysis…</p>
              <p className="text-xs mt-1 text-gray-400">This may take a minute for large datasets</p>
            </div>
          </div>
        )}

        {!loading && !hasData && !error && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No results yet</p>
            <p className="text-sm mt-1">Click &ldquo;Run Migration Analysis&rdquo; to begin</p>
          </div>
        )}

        {!loading && hasData && (
          <MigrationTable
            results={results}
            updatedOpps={updatedOpps}
            instanceUrl={instanceUrl}
            pricebookNames={pricebookNames}
            sessionApprovedIds={sessionApprovedIds}
            sessionConfirmedIds={sessionConfirmedIds}
            onApproved={handleApproved}
          />
        )}
      </div>
    </div>
  );
}
