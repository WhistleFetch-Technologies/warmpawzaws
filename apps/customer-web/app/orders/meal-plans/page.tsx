'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Package, MapPin, Calendar, Clock, CheckCircle, Truck, Home,
  Key, Eye, EyeOff, Copy, Check, Phone, User, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { goBackOrHome } from '@/lib/go-back-or-replace';

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
  // Delivery OTP fields
  delivery_otp?: string;
  otp_verified?: boolean;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
}

// Format delivery slot from API (object or string) to display time
function formatDeliveryTime(slot: any): string {
  if (!slot) return '';
  if (typeof slot === 'string') return slot;
  if (slot.start) return slot.start;
  if (slot.end) return slot.end;
  return '';
}

function MealPlanOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneForTracking =
    searchParams?.get('phone')?.trim() ||
    (typeof window !== 'undefined' ? localStorage.getItem('customerPhone')?.trim() || '' : '');
  const [orders, setOrders] = useState<MealPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<MealPlanOrder | null>(null);
  
  // OTP display states
  const [showOTP, setShowOTP] = useState<Record<string, boolean>>({});
  const [copiedOTP, setCopiedOTP] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [searchParams]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Get customer ID: phone from URL (from My Bookings) first, then localStorage
      const phoneFromUrl = searchParams?.get('phone') || '';
      const customerPhone = phoneFromUrl || localStorage.getItem('customerPhone') || '';
      if (!customerPhone) {
        setOrders([]);
        return;
      }
      const customer: any = await apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customer?.customer?.id || customer?.id;

      if (customerId) {
        const response: any = await apiClient.get(`/customer/meal-plan-orders?customerId=${customerId}`);
        const mealPlanOrders = (response?.orders || []).map((o: any) => ({
          ...o,
          meal_plan_name: o.meal_plan_name || o.meal_plan_id || 'Meal Plan',
          // Map API fields to page shape so "Track Order" and delivery display work
          delivery_date: o.delivery_date || o.scheduled_delivery_date || o.created_at,
          delivery_time: o.delivery_time || formatDeliveryTime(o.scheduled_delivery_slot) || '',
          delivery_address: typeof o.delivery_address === 'string' 
            ? (() => { try { const p = JSON.parse(o.delivery_address); return p?.address || p?.addressLine1 || o.delivery_address; } catch { return o.delivery_address; } })() 
            : (o.delivery_address?.address || o.delivery_address?.addressLine1 || ''),
        }));
        setOrders(mealPlanOrders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Copy OTP to clipboard
  const copyOTP = (orderId: string, otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOTP(orderId);
    toast.success('OTP copied to clipboard');
    setTimeout(() => setCopiedOTP(null), 2000);
  };

  // Toggle OTP visibility for an order
  const toggleOTPVisibility = (orderId: string) => {
    setShowOTP(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Check if order is out for delivery
  const isOutForDelivery = (status: string) => {
    return ['out_for_delivery', 'dispatched', 'in_transit', 'arriving', 'on_way'].includes(status.toLowerCase());
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
            onClick={() => goBackOrHome(router)}
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
                        <span>Delivery: {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{order.delivery_time || '—'}</span>
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

                {/* Delivery OTP Section - Show when out for delivery */}
                {isOutForDelivery(order.status) && order.delivery_otp && !order.otp_verified && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-orange-600" />
                        <span className="font-bold text-orange-800">Your Delivery OTP</span>
                      </div>
                      {order.delivery_partner_name && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <User className="w-4 h-4" />
                            <span>{order.delivery_partner_name}</span>
                          </div>
                          {order.delivery_partner_phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `tel:${order.delivery_partner_phone}`;
                              }}
                              className="p-2 bg-orange-100 rounded-full hover:bg-orange-200 transition"
                            >
                              <Phone className="w-4 h-4 text-orange-600" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* OTP Display */}
                    <div className="flex justify-center gap-2 mb-3">
                      {order.delivery_otp.split('').map((digit, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-14 bg-white rounded-lg shadow-sm border-2 border-orange-300 flex items-center justify-center"
                        >
                          <span className="text-2xl font-bold text-orange-600">
                            {showOTP[order.id] ? digit : '•'}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* OTP Actions */}
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOTPVisibility(order.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition text-sm font-medium"
                      >
                        {showOTP[order.id] ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Hide OTP
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Show OTP
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyOTP(order.id, order.delivery_otp!);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition text-sm font-medium"
                      >
                        {copiedOTP === order.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy OTP
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Instructions */}
                    <div className="mt-3 flex items-start gap-2 text-sm text-orange-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>Share this OTP with the delivery partner only after receiving your order.</p>
                    </div>
                  </div>
                )}

                {/* OTP Verified Badge */}
                {order.otp_verified && order.status.toLowerCase() === 'delivered' && (
                  <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200 flex items-center justify-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Delivery Confirmed!</p>
                      <p className="text-sm text-green-600">Your meal plan has been delivered successfully.</p>
                    </div>
                  </div>
                )}

                {/* Track Order: always visible so customer can access meal tracker at will (OBJECTIVE 1) */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Ordered: {new Date(order.created_at).toLocaleString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const q = new URLSearchParams();
                      q.set('from', 'meal-plans');
                      if (phoneForTracking) q.set('phone', phoneForTracking);
                      router.push(`/track/${order.id}?${q.toString()}`);
                    }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600"
                  >
                    Track Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MealPlanOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <MealPlanOrdersContent />
    </Suspense>
  );
}
