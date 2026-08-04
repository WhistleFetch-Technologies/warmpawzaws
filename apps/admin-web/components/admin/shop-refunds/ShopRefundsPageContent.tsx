'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { apiClient } from '@/lib/api-client';

type ShopRefundRow = {
  id: string;
  refund_amount: string | number;
  refund_status: string;
  refund_reason?: string;
  order_number?: string;
  customer_name?: string;
  vendor_name?: string;
  requested_at?: string;
  retry_count?: number;
  razorpay_refund_id?: string;
};

type MissingRefundRow = {
  order_id: string;
  order_number?: string;
  customer_name?: string;
  vendor_name?: string;
  refund_amount?: string | number;
  razorpay_payment_id?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
};

const PAGE_SIZE = 50;

export function ShopRefundsPageContent() {
  const [tab, setTab] = useState<'refunds' | 'missing' | 'returns'>('refunds');
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<ShopRefundRow[]>([]);
  const [missingRows, setMissingRows] = useState<MissingRefundRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'refunds') {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          status,
        });
        const res = await apiClient.get<{ refunds?: ShopRefundRow[]; total?: number }>(
          `/admin/shop-refunds?${params.toString()}`,
        );
        setRows(res.refunds || []);
        setTotal(res.total || 0);
      } else if (tab === 'missing') {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await apiClient.get<{ missing?: MissingRefundRow[]; total?: number }>(
          `/admin/shop-refunds/missing?${params.toString()}`,
        );
        setMissingRows(res.missing || []);
        setTotal(res.total || 0);
      } else {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          status: 'pending,approved',
        });
        const res = await apiClient.get<{ returns?: ShopRefundRow[]; total?: number }>(
          `/admin/shop-returns?${params.toString()}`,
        );
        setRows(res.returns || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [offset, status, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryRefund = async (refundId: string) => {
    setActionId(refundId);
    try {
      await apiClient.post(`/admin/shop-refunds/${refundId}/retry`, {});
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setActionId(null);
    }
  };

  const reconcileRefund = async (refundId: string) => {
    setActionId(refundId);
    try {
      await apiClient.post(`/admin/shop-refunds/${refundId}/reconcile`, {});
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reconcile failed');
    } finally {
      setActionId(null);
    }
  };

  const initiateRefund = async (orderNumber: string) => {
    setActionId(orderNumber);
    try {
      await apiClient.post('/admin/shop-refunds/initiate', {
        orderNumber,
        reason: 'Admin initiated shop refund',
      });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Initiate failed');
    } finally {
      setActionId(null);
    }
  };

  const displayRows = tab === 'missing' ? missingRows : rows;

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-orange-700">Shop Refunds</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ecommerce cancel and return refunds — initiate missing refunds, retry failed, reconcile processing
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setTab('refunds');
                  setOffset(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm ${
                  tab === 'refunds' ? 'bg-orange-500 text-white' : 'bg-white border'
                }`}
              >
                Refunds
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('missing');
                  setOffset(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm ${
                  tab === 'missing' ? 'bg-orange-500 text-white' : 'bg-white border'
                }`}
              >
                Missing refunds
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('returns');
                  setOffset(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm ${
                  tab === 'returns' ? 'bg-orange-500 text-white' : 'bg-white border'
                }`}
              >
                Returns queue
              </button>
            </div>

            {tab === 'refunds' ? (
              <div className="flex gap-2 flex-wrap">
                {['pending', 'failed', 'processing', 'completed'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      setOffset(0);
                    }}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      status === s ? 'bg-orange-100 border-orange-300' : 'bg-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {tab === 'missing' ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Cancelled paid shop orders with no active refund row. Use Initiate to trigger Razorpay refund.
              </p>
            ) : null}

            {loading ? <p className="text-gray-500">Loading…</p> : null}

            <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    {tab === 'refunds' ? (
                      <>
                        <th className="p-3">Order</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Vendor</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Razorpay refund</th>
                        <th className="p-3">Action</th>
                      </>
                    ) : tab === 'missing' ? (
                      <>
                        <th className="p-3">Order</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Vendor</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Razorpay payment</th>
                        <th className="p-3">Cancelled</th>
                        <th className="p-3">Action</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3">Return</th>
                        <th className="p-3">Order</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === 'missing'
                    ? missingRows.map((row) => (
                        <tr key={row.order_id} className="border-t">
                          <td className="p-3">{row.order_number || row.order_id.slice(0, 8)}</td>
                          <td className="p-3">{row.customer_name || '—'}</td>
                          <td className="p-3">{row.vendor_name || '—'}</td>
                          <td className="p-3">₹{Number(row.refund_amount || 0).toFixed(2)}</td>
                          <td className="p-3 font-mono text-xs">{row.razorpay_payment_id || '—'}</td>
                          <td className="p-3 text-xs text-gray-500">
                            {row.cancelled_at ? new Date(row.cancelled_at).toLocaleString() : '—'}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              disabled={actionId === row.order_number}
                              onClick={() => void initiateRefund(row.order_number || row.order_id)}
                              className="text-orange-600 hover:underline disabled:opacity-50"
                            >
                              Initiate refund
                            </button>
                          </td>
                        </tr>
                      ))
                    : rows.map((row) => (
                        <tr key={row.id} className="border-t">
                          {tab === 'refunds' ? (
                            <>
                              <td className="p-3">{row.order_number || '—'}</td>
                              <td className="p-3">{row.customer_name || '—'}</td>
                              <td className="p-3">{row.vendor_name || '—'}</td>
                              <td className="p-3">₹{Number(row.refund_amount || 0).toFixed(2)}</td>
                              <td className="p-3 capitalize">{row.refund_status}</td>
                              <td className="p-3 font-mono text-xs">{row.razorpay_refund_id || '—'}</td>
                              <td className="p-3 space-x-2">
                                {['pending', 'failed'].includes(row.refund_status) ? (
                                  <button
                                    type="button"
                                    disabled={actionId === row.id}
                                    onClick={() => void retryRefund(row.id)}
                                    className="text-orange-600 hover:underline disabled:opacity-50"
                                  >
                                    Retry
                                  </button>
                                ) : null}
                                {row.refund_status === 'processing' && row.razorpay_refund_id ? (
                                  <button
                                    type="button"
                                    disabled={actionId === row.id}
                                    onClick={() => void reconcileRefund(row.id)}
                                    className="text-blue-600 hover:underline disabled:opacity-50"
                                  >
                                    Reconcile
                                  </button>
                                ) : null}
                                {!['pending', 'failed'].includes(row.refund_status) &&
                                !(row.refund_status === 'processing' && row.razorpay_refund_id)
                                  ? '—'
                                  : null}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3">
                                {(row as { return_number?: string }).return_number || row.id.slice(0, 8)}
                              </td>
                              <td className="p-3">{row.order_number || '—'}</td>
                              <td className="p-3">{row.customer_name || '—'}</td>
                              <td className="p-3 capitalize">
                                {row.refund_status || (row as { status?: string }).status}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                </tbody>
              </table>
              {!loading && displayRows.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No rows found.</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
