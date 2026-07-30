'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Package,
  Phone,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type OrderItem = {
  id?: string;
  name?: string;
  product_name?: string;
  quantity?: number;
  price?: number | string;
  unit_price?: number | string;
  emoji?: string;
};

type AdminOrderDetail = {
  id: string;
  order_number?: string;
  status?: string;
  order_status?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  vendor_name?: string;
  vendor_phone?: string;
  delivery_address?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_pincode?: string;
  shipping_phone?: string;
  subtotal?: number | string;
  discount_amount?: number | string;
  vendor_promotion_amount?: number | string;
  admin_promotion_amount?: number | string;
  shipping_amount?: number | string;
  shipping_fee?: number | string;
  tax_amount?: number | string;
  cgst_amount?: number | string;
  sgst_amount?: number | string;
  igst_amount?: number | string;
  wallet_amount_applied?: number | string;
  total_amount?: number | string;
  payment_status?: string;
  payment_method?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  items?: OrderItem[];
};

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
];

function formatInr(value: number | string | null | undefined): string {
  return `₹${Number(value || 0).toLocaleString()}`;
}

function getOrderStatus(order: AdminOrderDetail): string {
  return String(order.status ?? order.order_status ?? 'pending');
}

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ order?: AdminOrderDetail }>(
        `/admin/ecommerce/orders/${orderId}`,
      );
      setOrder(data.order || null);
      if (!data.order) setError('Order not found');
    } catch (err: unknown) {
      console.error('Error loading order:', err);
      setOrder(null);
      setError((err as Error)?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return;
    try {
      setUpdatingStatus(true);
      await apiClient.put(`/orders/${order.id}/status`, { status: newStatus });
      setOrder({ ...order, status: newStatus, order_status: newStatus });
    } catch (err: unknown) {
      console.error('Error updating order:', err);
      alert((err as Error)?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto" />
        <p className="mt-4 text-slate-500">Loading order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8">
        <Link
          href="/ecommerce?tab=orders"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error || 'Order not found'}
        </div>
      </div>
    );
  }

  const status = getOrderStatus(order);
  const items = order.items || [];
  const deliveryAddress =
    order.delivery_address ||
    [
      order.shipping_address,
      order.shipping_city,
      order.shipping_state,
      order.shipping_pincode,
    ]
      .filter(Boolean)
      .join(', ');
  const shippingAmount = Number(order.shipping_amount ?? order.shipping_fee ?? 0);
  const vendorPromo = Number(order.vendor_promotion_amount || 0);
  const adminPromo = Number(order.admin_promotion_amount || 0);
  const walletApplied = Number(order.wallet_amount_applied || 0);
  const discountTotal = Number(order.discount_amount || 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link
        href="/ecommerce?tab=orders"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to orders
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Order #{String(order.order_number || order.id).slice(-8)}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Placed on {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}
          </p>
        </div>
        <select
          value={status}
          disabled={updatingStatus}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateOrderStatus(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-xl">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer
          </h4>
          <p className="font-medium text-blue-800">{order.customer_name || 'N/A'}</p>
          {order.customer_phone && (
            <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3" /> {order.customer_phone}
            </p>
          )}
          {order.customer_email && (
            <p className="text-sm text-blue-600 mt-1">{order.customer_email}</p>
          )}
        </div>
        <div className="p-4 bg-purple-50 rounded-xl">
          <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <Store className="w-4 h-4" /> Seller
          </h4>
          <p className="font-medium text-purple-800">{order.vendor_name || 'N/A'}</p>
          {order.vendor_phone && (
            <p className="text-sm text-purple-600 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3" /> {order.vendor_phone}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-500">Payment</p>
          <p className="font-medium text-slate-900 capitalize">
            {order.payment_status || '—'} · {order.payment_method || '—'}
          </p>
        </div>
        {deliveryAddress && (
          <div className="p-4 bg-slate-50 rounded-xl">
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Delivery Address
            </h4>
            <p className="text-slate-600">{deliveryAddress}</p>
            {order.shipping_phone && (
              <p className="text-sm text-slate-500 mt-1">Phone: {order.shipping_phone}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Order Items
        </h4>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <p className="p-4 text-slate-500 text-sm">No items found</p>
          ) : (
            items.map((item, idx) => {
              const unitPrice = Number(item.price ?? item.unit_price ?? 0);
              const qty = Number(item.quantity || 1);
              return (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                      {item.emoji || '📦'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.name || item.product_name || 'Product'}
                      </p>
                      <p className="text-sm text-slate-500">Qty: {qty}</p>
                    </div>
                  </div>
                  <p className="font-bold text-slate-900 tabular-nums">
                    {formatInr(unitPrice * qty)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 space-y-2">
        <h4 className="font-semibold text-slate-900 mb-2">Customer payment breakdown</h4>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="text-slate-900 tabular-nums">
            {formatInr(order.subtotal ?? order.total_amount)}
          </span>
        </div>
        {vendorPromo > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600">Vendor promotion</span>
            <span className="text-emerald-600 tabular-nums">-{formatInr(vendorPromo)}</span>
          </div>
        )}
        {adminPromo > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600">Platform promotion</span>
            <span className="text-emerald-600 tabular-nums">-{formatInr(adminPromo)}</span>
          </div>
        )}
        {discountTotal > 0 && vendorPromo === 0 && adminPromo === 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600">Discount</span>
            <span className="text-emerald-600 tabular-nums">-{formatInr(discountTotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Delivery charges</span>
          <span className="text-slate-900 tabular-nums">{formatInr(shippingAmount)}</span>
        </div>
        {Number(order.cgst_amount || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">CGST</span>
            <span className="text-slate-900 tabular-nums">{formatInr(order.cgst_amount)}</span>
          </div>
        )}
        {Number(order.sgst_amount || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">SGST</span>
            <span className="text-slate-900 tabular-nums">{formatInr(order.sgst_amount)}</span>
          </div>
        )}
        {Number(order.igst_amount || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">IGST</span>
            <span className="text-slate-900 tabular-nums">{formatInr(order.igst_amount)}</span>
          </div>
        )}
        {Number(order.tax_amount || 0) > 0 &&
          Number(order.cgst_amount || 0) === 0 &&
          Number(order.sgst_amount || 0) === 0 &&
          Number(order.igst_amount || 0) === 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">GST</span>
              <span className="text-slate-900 tabular-nums">{formatInr(order.tax_amount)}</span>
            </div>
          )}
        {walletApplied > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Wallet applied</span>
            <span className="text-slate-900 tabular-nums">-{formatInr(walletApplied)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-orange-200">
          <span className="text-slate-900">Total paid</span>
          <span className="text-orange-600 tabular-nums">{formatInr(order.total_amount)}</span>
        </div>
      </div>

      {order.tracking_number && (
        <div className="p-4 bg-indigo-50 rounded-xl">
          <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <Truck className="w-4 h-4" /> Tracking
          </h4>
          <p className="font-mono text-indigo-700">{order.tracking_number}</p>
          {order.carrier && (
            <p className="text-sm text-indigo-600 mt-1">Carrier: {order.carrier}</p>
          )}
          {order.tracking_url && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 underline mt-1 inline-block"
            >
              Track shipment
            </a>
          )}
        </div>
      )}
    </div>
  );
}
