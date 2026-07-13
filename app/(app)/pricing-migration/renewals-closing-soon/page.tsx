'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RenewalsClosingSoonTable from '@/components/pricing-migration/RenewalsClosingSoonTable';
import type { RenewalOpp } from '@/app/api/pricing-migration/renewals-closing-soon/route';

const CACHE_KEY = 'renewals_closing_soon_cache';

interface Cache {
  opps: RenewalOpp[];
  instanceUrl: string;
  loadedAt: number;
}

export default function RenewalsClosingSoonPage() {
  const router = useRouter();
  const [opps, setOpps] = useState<RenewalOpp[]>([]);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache: Cache = JSON.parse(raw);
        setOpps(cache.opps);
        setInstanceUrl(cache.instanceUrl);
        setLoadedAt(cache.loadedAt);
      }
    } catch { /* ignore */ }
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pricing-migration/renewals-closing-soon');
      if (res.status === 401) { router.push('/login?error=no_session'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return; }
      const now = Date.now();
      setOpps(data.opps ?? []);
      setInstanceUrl(data.instanceUrl ?? '');
      setLoadedAt(now);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ opps: data.opps ?? [], instanceUrl: data.instanceUrl ?? '', loadedAt: now } satisfies Cache));
      } catch { /* storage full */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const hasData = opps.length > 0;

  return (
    <div>
      <div className="px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Renewals Closing Soon</h1>
          <p className="text-sm text-gray-500 mt-0.5">Open renewal opportunities by stage and auto-renew status</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading…' : 'Load Renewals'}
          </button>
          {loadedAt && !loading && (
            <span className="text-xs text-gray-400">
              Loaded {new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 pb-8">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading renewals from Salesforce…</p>
            </div>
          </div>
        )}

        {!loading && !hasData && !error && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No data yet</p>
            <p className="text-sm mt-1">Click &ldquo;Load Renewals&rdquo; to fetch opportunities</p>
          </div>
        )}

        {!loading && hasData && (
          <RenewalsClosingSoonTable opps={opps} instanceUrl={instanceUrl} />
        )}
      </div>
    </div>
  );
}
