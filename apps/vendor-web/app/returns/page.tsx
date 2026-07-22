'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { VendorHeader } from '@/components/vendor/VendorHeader';

type ReturnRow = {
  id: string;
  returnNumber: string;
  orderNumber?: string;
  status: string;
  reason?: string;
  totalRefundAmount?: number;
  refundMethod?: string;
  customerName?: string;
  itemCount?: number;
  createdAt?: string;
};

const PAGE_SIZE = 20;

export default function VendorReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiClient.get<{ returns?: ReturnRow[]; success?: boolean }>(
        `/vendor/${vendorId}/returns?${params.toString()}`,
      );
      setReturns(res.returns || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [offset, router, statusFilter]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const decide = async (returnId: string, decision: 'approve' | 'reject') => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) return;
    setActingId(returnId);
    try {
      await apiClient.put(`/vendor/${vendorId}/returns/${returnId}/decision`, {
        decision,
        refundMethod: 'original_payment',
        rejectionReason: decision === 'reject' ? 'Does not meet return policy' : undefined,
      });
      await loadReturns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <VendorHeader title="Returns" subtitle="Review customer return requests" />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setOffset(0);
                setStatusFilter(s);
              }}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                statusFilter === s
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? <p className="text-slate-500">Loading returns…</p> : null}
        {error ? <p className="text-red-600">{error}</p> : null}

        {!loading && returns.length === 0 ? (
          <p className="text-slate-500">No return requests found.</p>
        ) : null}

        <ul className="space-y-3">
          {returns.map((row) => (
            <li key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{row.returnNumber}</p>
                  <p className="text-sm text-slate-500">
                    Order {row.orderNumber || '—'} · {row.customerName || 'Customer'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">{row.status}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">₹{Number(row.totalRefundAmount || 0).toFixed(2)}</p>
                  <p className="text-slate-500">{row.itemCount || 0} items</p>
                </div>
              </div>
              {row.status === 'pending' ? (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={actingId === row.id}
                    onClick={() => void decide(row.id, 'approve')}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingId === row.id}
                    onClick={() => void decide(row.id, 'reject')}
                    className="flex-1 py-2 rounded-lg border border-red-200 text-red-600 text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="flex justify-between pt-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={returns.length < PAGE_SIZE}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}
