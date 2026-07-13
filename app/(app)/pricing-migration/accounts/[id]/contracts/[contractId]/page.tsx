'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MigrationPreview from '@/components/pricing-migration/MigrationPreview';
import type { PreviewData } from '@/components/pricing-migration/MigrationPreview';
import type { DBAccount, Transaction, MigrationResult } from '@/lib/pricing-migration/migration/types';

interface DBAccountGroup {
  dbAccountId: string;
  dbAccount: DBAccount | null;
  transactions: Transaction[];
}

interface ContractData {
  contractId: string;
  contractName: string;
  contractStatus: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  accountId: string | null;
  accountName: string;
  instanceUrl: string;
  dbAccountGroups: DBAccountGroup[];
  unlinkedTransactions: Transaction[];
}

function contractStatusColor(status: string | null): string {
  const l = status?.toLowerCase() ?? '';
  if (l.includes('cancel'))  return 'bg-red-100 text-red-700 border-red-200';
  if (l === 'active')        return 'bg-green-100 text-green-700 border-green-300';
  if (l === 'upcoming')      return 'bg-blue-100 text-blue-700 border-blue-200';
  if (l === 'expired')       return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

function fmt(n: number, currency: string) {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

function RollupStrip({
  contractData,
  results,
}: {
  contractData: ContractData;
  results: Record<string, MigrationResult | null>;
}) {
  const currency = contractData.currency;
  const allTx = contractData.dbAccountGroups.flatMap(g => g.transactions);
  const currentArrTotal = allTx.reduce((sum, tx) => sum + (tx.localArr ?? 0), 0);

  const completedResults = Object.values(results).filter((r): r is MigrationResult => r != null);
  const newPriceTotal = completedResults.reduce((sum, r) => sum + r.step4.priceBreakdown.total, 0);
  const delta = completedResults.reduce((sum, r) => sum + r.step6.delta, 0);
  const overallStatus = completedResults.some(r => r.step6.status === 'Needs Review')
    ? 'Needs Review'
    : completedResults.length > 0 ? 'Pass' : null;

  const expectedGroups = contractData.dbAccountGroups.filter(g => g.dbAccount != null).length;
  const loaded = completedResults.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract Summary</span>
        {loaded < expectedGroups && (
          <span className="text-xs text-gray-400">{loaded} / {expectedGroups} DB accounts loaded</span>
        )}
        {overallStatus && (
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
            overallStatus === 'Pass'
              ? 'bg-green-100 text-green-700 border-green-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {overallStatus === 'Pass' ? '✓ Ready to migrate' : '⚠ Needs review'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Current ARR</div>
          <div className="text-lg font-bold text-gray-900">{fmt(currentArrTotal, currency)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">New List Price</div>
          <div className="text-lg font-bold text-gray-900">
            {loaded > 0 ? fmt(newPriceTotal, currency) : <span className="text-gray-400 text-sm">—</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Delta</div>
          <div className={`text-lg font-bold ${
            loaded === 0 ? 'text-gray-400' :
            delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-gray-700'
          }`}>
            {loaded === 0 ? '—' : (delta >= 0 ? '↑ ' : '↓ ') + fmt(Math.abs(delta), currency)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContractMigrationPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const { contractId } = use(params);
  const router = useRouter();

  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<Record<string, MigrationResult | null>>({});

  const handleResult = useCallback((dbAccountId: string, result: MigrationResult | null) => {
    setResults(prev => ({ ...prev, [dbAccountId]: result }));
  }, []);

  useEffect(() => {
    fetch(`/api/pricing-migration/contracts/${contractId}`)
      .then(res => {
        if (res.status === 401) { router.push('/login?error=no_session'); return null; }
        return res.json();
      })
      .then((json: (ContractData & { error?: string }) | null) => {
        if (!json) return;
        if (json.error) setError(json.error);
        else setContractData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contractId, router]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Link href="/pricing-migration/accounts" className="hover:text-blue-600 transition-colors">Accounts</Link>
          <span>›</span>
          {contractData?.accountId ? (
            <Link href={`/pricing-migration/accounts/${contractData.accountId}`} className="hover:text-blue-600 transition-colors">
              {contractData.accountName || contractData.accountId}
            </Link>
          ) : (
            <span>{contractData?.accountName ?? '…'}</span>
          )}
          <span>›</span>
          <span className="text-gray-600">{contractData?.contractName ?? '…'}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              {contractData?.contractName ?? 'Contract Migration'}
            </h1>
            {contractData?.contractStatus && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${contractStatusColor(contractData.contractStatus)}`}>
                {contractData.contractStatus}
              </span>
            )}
          </div>
          {contractData?.instanceUrl && (
            <a href={`${contractData.instanceUrl}/${contractId}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline">
              View in Salesforce ↗
            </a>
          )}
        </div>

        {(contractData?.startDate || contractData?.endDate) && (
          <p className="text-sm text-gray-500 mt-1">
            {contractData.startDate ?? '?'} → {contractData.endDate ?? '?'}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading contract data from Salesforce…</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && contractData && (
        <>
          <RollupStrip contractData={contractData} results={results} />

          {contractData.dbAccountGroups.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No transactions found for this contract
            </div>
          )}

          {contractData.dbAccountGroups.map((group, idx) => {
            if (!group.dbAccount) {
              return (
                <div key={group.dbAccountId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2">
                    DB Account {idx + 1} — {group.dbAccountId}
                  </div>
                  <p className="text-sm text-gray-400">DB Account record not found in Salesforce</p>
                </div>
              );
            }

            const previewData: PreviewData = {
              accountId: group.dbAccount.id,
              accountName: group.dbAccount.analyticsGroupId,
              currency: contractData.currency,
              currentLocalCARR: group.dbAccount.localCarr,
              lastPricebookId: null,
              dbAccount: group.dbAccount,
              transactions: group.transactions,
            };

            return (
              <div key={group.dbAccountId}>
                {contractData.dbAccountGroups.length > 1 && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      DB Account {idx + 1} · {group.dbAccount.analyticsGroupId}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}
                <MigrationPreview
                  data={previewData}
                  onResult={r => handleResult(group.dbAccountId, r)}
                />
              </div>
            );
          })}

          {contractData.unlinkedTransactions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-700 mb-2">
                ⚠ {contractData.unlinkedTransactions.length} transaction{contractData.unlinkedTransactions.length > 1 ? 's' : ''} not linked to a DB Account
              </div>
              <ul className="space-y-1">
                {contractData.unlinkedTransactions.map(tx => (
                  <li key={tx.id} className="text-xs text-amber-700">
                    {tx.itemName} · {tx.localArr != null ? fmt(tx.localArr, tx.currencyCode) : '—'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

