'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  buildWpayTransactionsUrl,
  wpayNextCursor,
  wpayTransactionsFromResponse,
  type WpayTransactionCard,
} from '@/lib/warmpawz-pay/wpay-api';

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WarmpawzPayHistoryPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [rows, setRows] = useState<WpayTransactionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '';
    setPhone(p);
  }, []);

  const load = async (append: boolean, nextCursor?: string | null) => {
    if (!phone) {
      setError('Please log in to view payment history');
      setLoading(false);
      return;
    }
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const url = buildWpayTransactionsUrl({
        limit: 5,
        phone,
        cursor: append ? nextCursor ?? undefined : undefined,
      });
      const data = await apiClient.get(url);
      const batch = wpayTransactionsFromResponse(data);
      const nc = wpayNextCursor(data);
      setCursor(nc);
      setRows((prev) => (append ? [...prev, ...batch] : batch));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
      if (!append) setRows([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!phone) return;
    void load(false);
  }, [phone]);

  return (
    <div className="mx-auto w-full max-w-customer">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button type="button" onClick={() => router.push('/warmpawz-pay')} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Warmpawz Pay History</h1>
      </header>

      <div className="space-y-3 p-4">
        {loading ? <p className="text-center text-sm text-gray-500">Loading…</p> : null}
        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No payments yet.</p>
        ) : null}

        {rows.map((r) => (
          <div key={r.paymentId} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-semibold text-gray-900">{r.vendorName}</p>
            {r.vendorCategory ? <p className="text-xs text-gray-500">{r.vendorCategory}</p> : null}
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <span className="text-gray-500">Quoted</span>
              <span className="text-right">{formatInr(r.originalAmount)}</span>
              <span className="text-gray-500">Discount ({r.discountPercent}%)</span>
              <span className="text-right text-green-700">- {formatInr(r.discountAmount)}</span>
              <span className="font-medium">Paid</span>
              <span className="text-right font-semibold">{formatInr(r.payableAmount)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {new Date(r.paidAt).toLocaleString('en-IN')}
            </p>
          </div>
        ))}

        {cursor ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(true, cursor)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
