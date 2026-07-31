'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ORDER_STATUSES = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'returned', label: 'Returned' },
];

const PAGE_SIZE = 25;

type AdminOrderListRow = {
  id: string;
  order_number?: string;
  status?: string;
  order_status?: string;
  customer_name?: string;
  customer_phone?: string;
  vendor_name?: string;
  total_amount?: number | string;
  discount_amount?: number | string;
  item_count?: number;
  created_at?: string;
};

export function OrderManagementAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setOffset(0);
  }, [selectedStatus, dateRange, debouncedSearch]);

  const loadCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period: dateRange });
      const data = await apiClient.get<{ counts?: Record<string, number> }>(
        `/admin/ecommerce/orders/counts?${params.toString()}`,
      );
      setStatusCounts(data.counts || {});
    } catch (err) {
      console.error('Error loading order counts:', err);
    }
  }, [dateRange]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        period: dateRange,
      });
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const data = await apiClient.get<{
        orders?: AdminOrderListRow[];
        total?: number;
      }>(`/admin/ecommerce/orders?${params.toString()}`);

      setOrders(data.orders || []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      console.error('Error loading orders:', err);
      setOrders([]);
      setTotal(0);
      setError((err as Error)?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [offset, selectedStatus, dateRange, debouncedSearch]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const getOrderStatus = (order: AdminOrderListRow): string =>
    (order.status ?? order.order_status ?? 'pending') as string;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      pending_payment: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-blue-100 text-blue-700',
      processing: 'bg-indigo-100 text-indigo-700',
      shipped: 'bg-purple-100 text-purple-700',
      delivered: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700',
      returned: 'bg-orange-100 text-orange-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const openOrderDetail = (orderId: string) => {
    router.push(`/ecommerce/orders/${orderId}`);
  };

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Manage marketplace orders across all sellers</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-500/25"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {ORDER_STATUSES.map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => setSelectedStatus(status.id)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              selectedStatus === status.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status.label}
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                selectedStatus === status.id ? 'bg-white/20' : 'bg-slate-100'
              }`}
            >
              {statusCounts[status.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order ID, customer, or seller..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto" />
            <p className="mt-4 text-slate-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No orders found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Order</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Customer</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Seller</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Amount</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => openOrderDetail(order.id)}
                  className="hover:bg-orange-50/50 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <p className="font-mono font-medium text-slate-900">
                      #{(order.order_number || order.id || '').slice(-8)}
                    </p>
                    <p className="text-xs text-slate-500">{order.item_count ?? 0} items</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{order.customer_name || 'N/A'}</p>
                    <p className="text-sm text-slate-500">{order.customer_phone || ''}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{order.vendor_name || 'N/A'}</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-bold text-slate-900">
                      ₹{Number(order.total_amount || 0).toLocaleString()}
                    </p>
                    {Number(order.discount_amount || 0) > 0 && (
                      <p className="text-xs text-emerald-600">
                        -₹{Number(order.discount_amount).toLocaleString()} off
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        getOrderStatus(order),
                      )}`}
                    >
                      {getOrderStatus(order)}
                    </span>
                  </td>
                  <td className="p-4 text-center text-sm text-slate-500">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Showing {pageStart}–{pageEnd} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              disabled={offset === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
