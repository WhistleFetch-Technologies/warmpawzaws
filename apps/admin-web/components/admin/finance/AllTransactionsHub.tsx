'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useWarmpawzPayPayments } from '@/hooks/warmpawz-pay/useWarmpawzPayPayments';
import {
  defaultWpayPaymentsFilters,
  settleWarmpawzPayPayments,
  type WpayPaymentsFilters,
} from '@/lib/warmpawz-pay-payments-admin';
import {
  fetchWapptBookingsList,
  type WapptAdminBookingRow,
} from '@/lib/warmpawz-appointments-dashboard-admin';
import { VendorBookingEarningsReport } from '@/components/admin/finance/VendorBookingEarningsReport';
import { AnalyticsErrorState } from '@/components/admin/marketing/analytics/AnalyticsStateViews';
import { PaymentsFilterBar } from '@/components/admin/warmpawz-pay/dashboard/PaymentsFilterBar';
import { PaymentsTable } from '@/components/admin/warmpawz-pay/dashboard/PaymentsTable';
import { apiClient } from '@/lib/api-client';
import { formatWpayInr } from '@/lib/warmpawz-pay-payments-admin';
import { canSettleWarmpawzPayPayouts } from '@/lib/admin-permissions';

type Channel = 'wpay' | 'wappt' | 'marketplace' | 'ecommerce';

const CHANNELS: Array<{ id: Channel; label: string; hint: string }> = [
  {
    id: 'wpay',
    label: 'Pay Bill',
    hint: 'Warmpawz Pay — discount, fees, GST, burn, vendor payable, promo / wallet recon',
  },
  {
    id: 'wappt',
    label: 'Appointments',
    hint: 'Warmpawz Appointments — base fee plus promo discount / wallet / evaluation when present',
  },
  {
    id: 'marketplace',
    label: 'Marketplace bookings',
    hint: 'Tele + centre + home — Customer Paid with promo discount / wallet recon columns',
  },
  {
    id: 'ecommerce',
    label: 'Shop orders',
    hint: 'Ecommerce — amount, promo discount, wallet used, evaluation / cashback when present',
  },
];

const PAGE_SIZE = 10;

type EcomOrderRow = {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  vendor_name?: string;
  total_amount?: number;
  discount_amount?: number;
  wallet_amount?: number;
  wallet_amount_applied?: number;
  evaluation_id?: string | null;
  pending_cashback?: number;
  awarded_cashback?: number;
  status?: string;
  payment_status?: string;
  created_at?: string;
};

function ChannelTabs({
  channel,
  onChange,
}: {
  channel: Channel;
  onChange: (c: Channel) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {CHANNELS.map((c) => {
        const active = channel === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#FF8C42] text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function WpayChannel() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<WpayPaymentsFilters>(defaultWpayPaymentsFilters);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState(false);
  const canSettle = canSettleWarmpawzPayPayouts();
  const paymentsQuery = useWarmpawzPayPayments(page, PAGE_SIZE, filters);

  const selectedPendingCount = useMemo(() => {
    const items = paymentsQuery.data?.items ?? [];
    let count = 0;
    for (const id of selectedPaymentIds) {
      const row = items.find((item) => item.paymentId === id);
      if (row?.payoutStatus === 'pending') count += 1;
    }
    return count;
  }, [paymentsQuery.data?.items, selectedPaymentIds]);

  const handleFiltersChange = (next: WpayPaymentsFilters) => {
    setFilters(next);
    setPage(1);
    setSelectedPaymentIds(new Set());
  };

  const handleSettle = async () => {
    if (!canSettle) {
      toast.error('You do not have permission to settle Warmpawz Pay payouts');
      return;
    }
    const paymentIds = [...selectedPaymentIds];
    if (paymentIds.length === 0) return;
    if (!window.confirm(`Mark ${paymentIds.length} payout(s) as settled?`)) return;
    setSettling(true);
    try {
      const result = await settleWarmpawzPayPayments(paymentIds);
      toast.success(
        result.settledCount > 0
          ? `Settled ${result.settledCount} payout(s)`
          : 'No payouts were settled',
      );
      setSelectedPaymentIds(new Set());
      await paymentsQuery.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to settle payouts');
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Same ledger as{' '}
          <Link href="/warmpawz-pay" className="font-medium text-[#FF8C42] hover:underline">
            Warmpawz Pay
          </Link>
          . Expand a row for platform / convenience fee GST, burn, and promo / wallet recon.
        </p>
      </div>
      <PaymentsFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        disabled={paymentsQuery.isLoading || settling}
        settleDisabled={selectedPendingCount === 0}
        settleLabel={
          selectedPendingCount > 0
            ? `Settle selected (${selectedPendingCount})`
            : 'Settle selected'
        }
        settling={settling}
        onSettle={canSettle ? () => void handleSettle() : undefined}
      />
      {paymentsQuery.isLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {paymentsQuery.error ? (
        <AnalyticsErrorState
          message={paymentsQuery.error.message || 'Failed to load Pay Bill payments.'}
          onRetry={() => void paymentsQuery.refresh()}
        />
      ) : null}
      {!paymentsQuery.isLoading && !paymentsQuery.error && paymentsQuery.data ? (
        <PaymentsTable
          items={paymentsQuery.data.items}
          page={paymentsQuery.data.page}
          pageSize={paymentsQuery.data.pageSize}
          total={paymentsQuery.data.total}
          onPageChange={(p) => {
            setPage(p);
            setSelectedPaymentIds(new Set());
          }}
          selectedPaymentIds={selectedPaymentIds}
          onSelectedPaymentIdsChange={setSelectedPaymentIds}
        />
      ) : null}
    </div>
  );
}

function WapptChannel() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<readonly WapptAdminBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWapptBookingsList({ page, pageSize: PAGE_SIZE });
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Appointment fee bookings from{' '}
        <Link
          href="/warmpawz-appointments"
          className="font-medium text-[#FF8C42] hover:underline"
        >
          Warmpawz Appointments
        </Link>
        .
      </p>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? (
        <AnalyticsErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No appointment bookings yet.
        </p>
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3 text-right">Base fee</th>
                <th className="px-4 py-3 text-right">Promo discount (D)</th>
                <th className="px-4 py-3 text-right">Wallet used</th>
                <th className="px-4 py-3">Evaluation</th>
                <th className="px-4 py-3">Booked at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.bookingId} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.customerName || '—'}</p>
                    <p className="text-xs text-gray-500">{row.customerPhone || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{row.merchantDisplayName}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.bookingDate} {row.bookingTime}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatWpayInr(row.baseFeePaid)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {formatWpayInr(row.engineDiscountAmount ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatWpayInr(row.walletAmount ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 break-all">
                    {row.evaluationId || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600">
            <span>
              {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                className="rounded border px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EcommerceChannel() {
  const [orders, setOrders] = useState<EcomOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        success?: boolean;
        orders?: EcomOrderRow[];
        data?: { orders?: EcomOrderRow[] };
      }>('/admin/ecommerce/orders?limit=25&offset=0&period=30d');
      const list = Array.isArray(res?.orders)
        ? res.orders
        : Array.isArray(res?.data?.orders)
          ? res.data.orders
          : [];
      setOrders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shop orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Recent shop orders — full management on{' '}
        <Link
          href="/ecommerce?tab=orders"
          className="font-medium text-[#FF8C42] hover:underline"
        >
          Ecommerce → Orders
        </Link>
        .
      </p>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? <AnalyticsErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No shop orders in this window.
        </p>
      ) : null}
      {!loading && !error && orders.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Promo discount (D)</th>
                <th className="px-4 py-3 text-right">Wallet used</th>
                <th className="px-4 py-3 text-right">Cashback awarded</th>
                <th className="px-4 py-3">Evaluation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/ecommerce/orders/${row.id}`}
                      className="font-medium text-[#FF8C42] hover:underline"
                    >
                      {row.order_number || row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.customer_name || '—'}</p>
                    <p className="text-xs text-gray-500">{row.customer_phone || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{row.vendor_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatWpayInr(Number(row.total_amount) || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {formatWpayInr(Number(row.discount_amount) || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatWpayInr(
                      Number(row.wallet_amount ?? row.wallet_amount_applied) || 0,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatWpayInr(Number(row.awarded_cashback) || 0)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 break-all">
                    {row.evaluation_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.payment_status || row.status || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Finance hub: channel ledgers for Pay Bill, appointments, marketplace, shop. */
export function AllTransactionsHub() {
  const [channel, setChannel] = useState<Channel>('wpay');
  const meta = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">All transactions</h2>
        <p className="mt-1 text-sm text-gray-500">
          One place to open Pay Bill, appointment, marketplace booking, and shop ledgers. Each
          channel keeps its existing API and settlement rules.
        </p>
      </div>
      <ChannelTabs channel={channel} onChange={setChannel} />
      {meta ? <p className="text-sm text-gray-500">{meta.hint}</p> : null}
      {channel === 'wpay' ? <WpayChannel /> : null}
      {channel === 'wappt' ? <WapptChannel /> : null}
      {channel === 'marketplace' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Includes tele / centre / home marketplace bookings (Customer Paid). Same report as
            Booking earnings.
          </p>
          <VendorBookingEarningsReport />
        </div>
      ) : null}
      {channel === 'ecommerce' ? <EcommerceChannel /> : null}
    </div>
  );
}
