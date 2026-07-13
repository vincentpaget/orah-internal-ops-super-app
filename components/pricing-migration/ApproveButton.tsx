'use client';

import { useState } from 'react';
import type { MigrationResult } from '@/lib/pricing-migration/migration/types';
import type { EditableLine } from './MigrationModal';

interface Props {
  result: MigrationResult;
  overrideLines?: EditableLine[];
  orderNotes?: string;
  renewalProductsConfirmed?: boolean;
  label?: string;
  onApproved: (opportunityId: string) => void;
}

export default function ApproveButton({ result, overrideLines, orderNotes, renewalProductsConfirmed, label, onApproved }: Props) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading-products' | 'loading-fields' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleApprove() {
    setState('loading-products');
    try {
      // Call 1: update pricebook + OLIs
      const res1 = await fetch('/api/pricing-migration/migration/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ migrationResult: result, overrideLines }),
      });
      const data1 = await res1.json();
      if (!res1.ok) {
        setErrorMsg(data1.error ?? 'Failed to update products');
        setState('error');
        return;
      }

      // Call 2: update opportunity fields
      setState('loading-fields');
      const res2 = await fetch('/api/pricing-migration/migration/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: result.opportunityId,
          renewalProductsConfirmed,
          orderNotes: orderNotes ?? undefined,
        }),
      });
      const data2 = await res2.json();
      if (!res2.ok) {
        setErrorMsg(data2.error ?? 'Products updated but failed to update fields');
        setState('error');
        return;
      }

      setState('success');
      onApproved(result.opportunityId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed');
      setState('error');
    }
  }

  if (state === 'success') {
    return <span className="text-green-400 font-medium text-sm">✓ Updated</span>;
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-red-400 text-sm">{errorMsg}</span>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-gray-400 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'confirming') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">Update Salesforce?</span>
        <button
          onClick={handleApprove}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Confirm
        </button>
        <button
          onClick={() => setState('idle')}
          className="px-3 py-1 bg-gray-600 text-gray-200 text-sm rounded hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state === 'loading-products') {
    return <span className="text-sm text-gray-400">Updating products…</span>;
  }

  if (state === 'loading-fields') {
    return <span className="text-sm text-gray-400">Updating fields…</span>;
  }

  return (
    <button
      onClick={() => setState('confirming')}
      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
    >
      {label ?? 'Approve Migration'}
    </button>
  );
}
