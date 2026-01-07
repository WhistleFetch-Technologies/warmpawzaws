'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Package, MapPin, Calendar, Clock, CheckCircle, Truck, Home } from 'lucide-react';

interface MealPlanOrder {
  id: string;
  order_number: string;
  meal_plan_id: string;
  meal_plan_name: string;
  pet_id: string;
  pet_name: string;
  quantity: number;
  total_amount: number;
  status: string;
  delivery_date: string;
  delivery_time: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
}

export default function MealPlanOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<MealPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<MealPlanOrder | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Get customer ID from phone or session
      const customerPhone = localStorage.getItem('customerPhone') || '';
      const customer: any = await apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customer?.customer?.id || customer?.id;

      if (customerId) {
        const response: any = await apiClient.get(`/customer/orders?customerId=${customerId}&orderType=meal_plan_delivery`);
        const mealPlanOrders = (response?.orders || []).filter((o: any) => 
          o.order_type === 'meal_plan_delivery' || o.orderType === 'meal_plan_delivery'
        );
        setOrders(mealPlanOrders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'preparing':
        return <Package className="w-4 h-4" />;
      case 'out_for_delivery':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <Home className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="text-orange-500" size={32} />
            Meal Plan Orders
          </h1>
          <p className="text-gray-600 mt-2">Track your meal plan deliveries</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
            <p className="text-gray-600 mb-6">You haven't placed any meal plan orders yet.</p>
            <button
              onClick={() => router.push('/services/nutrition')}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600"
            >
              Order Meal Plan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {order.meal_plan_name || 'Meal Plan'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>Order #{order.order_number || order.id.slice(-8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Pet:</span>
                        <span>{order.pet_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Delivery: {new Date(order.delivery_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{order.delivery_time}</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{order.delivery_address || 'Address not available'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-orange-600">₹{order.total_amount}</p>
                    <p className="text-sm text-gray-500 mt-1">Qty: {order.quantity}</p>
                  </div>
                </div>

                {selectedOrder?.id === order.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">
                          Ordered: {new Date(order.created_at).toLocaleString()}
                        </p>
                        {order.updated_at && (
                          <p className="text-sm text-gray-600">
                            Updated: {new Date(order.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${order.id}`);
                        }}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

