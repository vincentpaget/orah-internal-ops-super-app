'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Contract {
  id: string;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  totalArr: number | null;
  currency: string;
}

interface AccountContractsData {
  accountId: string;
  accountName: string;
  instanceUrl: string;
  contracts: Contract[];
}

function contractStatusColor(status: string | null): string {
  const l = status?.toLowerCase() ?? '';
  if (l.includes('cancel'))  return 'bg-red-100 text-red-700 border-red-200';
  if (l === 'active')        return 'bg-green-100 text-green-700 border-green-300';
  if (l === 'upcoming')      return 'bg-blue-100 text-blue-700 border-blue-200';
  if (l === 'expired')       return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

function fmt(n: number | null, currency: string) {
  if (n == null) return '—';
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

export default function AccountContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AccountContractsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pricing-migration/accounts/${id}/contracts`)
      .then(res => {
        if (res.status === 401) { router.push('/login?error=no_session'); return null; }
        return res.json();
      })
      .then((json: (AccountContractsData & { error?: string }) | null) => {
        if (!json) return;
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="mb-6">
        <Link href="/pricing-migration/accounts" className="text-xs text-blue-600 hover:underline">
          ← Back to Accounts
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {data?.accountName ?? '…'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Contracts</p>
          </div>
          {data?.instanceUrl && (
            <a href={`${data.instanceUrl}/${id}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline">
              View in Salesforce ↗
            </a>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading contracts…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {data.contracts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">No contracts found for this account</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Contract</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Start</th>
                    <th className="text-left px-4 py-3">End</th>
                    <th className="text-right px-4 py-3">Total ARR</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.contracts.map(contract => (
                    <tr
                      key={contract.id}
                      onClick={() => router.push(`/pricing-migration/accounts/${id}/contracts/${contract.id}`)}
                      className="border-t border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{contract.name}</td>
                      <td className="px-4 py-3">
                        {contract.status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${contractStatusColor(contract.status)}`}>
                            {contract.status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{contract.startDate ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{contract.endDate ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums text-xs">
                        {fmt(contract.totalArr, contract.currency)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
