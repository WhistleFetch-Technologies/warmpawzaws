'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Package, MapPin, Clock } from 'lucide-react';

interface DeliveryOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  meal_plan_name: string;
  quantity: number;
  vendor_meal_total?: number;
  /** @deprecated Prefer vendor_meal_total (meal line only) */
  total_amount?: number;
  status: 'pending' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  order_date: string;
  delivery_date: string;
  delivery_time: string;
}

function listingRupee(o: DeliveryOrder): number {
  const v = o.vendor_meal_total ?? o.total_amount ?? 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function FoodDeliveryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'out_for_delivery' | 'delivered'>('all');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(
        `/vendor/${vendorId}/nutrition/delivery-orders?status=${filter === 'all' ? '' : filter}`
      );
      if (response.success || response.orders) {
        setOrders(response.orders || []);
      }
    } catch (error: any) {
      console.error('Error loading delivery orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: DeliveryOrder['status']) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.put(`/vendor/${vendorId}/nutrition/delivery-orders/${orderId}/status`, {
        status: newStatus,
      });
      loadOrders();
    } catch (error: any) {
      alert(error.message || 'Failed to update order status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    preparing: 'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="🚚 Food Delivery Orders"
          subtitle="Manage meal plan delivery orders"
          onBack={() => router.back()}
        />

        <main className="w-full px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'pending', 'preparing', 'out_for_delivery', 'delivered'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                filter === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🚚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No delivery orders</h3>
            <p className="text-gray-500">Orders will appear here when customers place meal plan deliveries</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Order #{order.order_number}</h3>
                    <p className="text-sm text-gray-500">{order.customer_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Meal Plan</p>
                      <p className="font-medium text-gray-900">{order.meal_plan_name}</p>
                      <p className="text-sm text-gray-500">Quantity: {order.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Delivery Address</p>
                      <p className="font-medium text-gray-900">{order.delivery_address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Delivery Date & Time</p>
                      <p className="font-medium text-gray-900">{order.delivery_date}</p>
                      <p className="text-sm text-gray-500">{order.delivery_time}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Meal total (your listing)</p>
                    <p className="text-xl font-bold text-orange-600">₹{listingRupee(order)}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                  >
                    Start Preparing
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                    className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium"
                  >
                    Mark Out for Delivery
                  </button>
                )}
                {order.status === 'out_for_delivery' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                  >
                    Mark as Delivered
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

