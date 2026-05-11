'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Package, MapPin, Truck, Clock, Check, AlertCircle, 
  Phone, ChevronRight, ArrowLeft, Navigation, RefreshCcw, MessageCircle, CheckCircle
} from 'lucide-react';
import {
  MealPlanOrderTrackingUI,
  formatMealOrderDisplayId,
} from '@/components/customer/tracking/MealPlanOrderTrackingUI';

interface TrackingData {
  success: boolean;
  orderType: 'ecommerce' | 'pharmacy' | 'meal';
  order: {
    id?: string;
    order_number?: string;
    orderNumber: string;
    status: string;
    total: number;
    total_amount?: number;
    createdAt: string;
  };
  tracking: {
    awb?: string;
    courier?: string;
    status: string;
    currentLocation?: string | { lat: number; lng: number };
    estimatedDelivery?: string;
    trackingUrl?: string;
    shippedAt?: string;
    deliveredAt?: string;
    assignedAt?: string;
    pickedUpAt?: string;
    events?: Array<{
      event: string;
      description: string;
      location: string;
      time: string;
    }>;
    deliveryPerson?: {
      name: string;
      phone: string;
      photo?: string;
      vehicleNumber?: string;
    };
    deliveryOtp?: string | null;
    eta?: number;
    distanceRemaining?: number;
    locationHistory?: Array<{ lat: number; lng: number; time: string }>;
  } | null;
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: Check },
];

const deliveryStatusSteps = [
  { key: 'pending_assignment', label: 'Finding Rider', icon: Clock },
  { key: 'assigned', label: 'Rider Assigned', icon: Truck },
  { key: 'at_pickup', label: 'At Pickup', icon: MapPin },
  { key: 'picked_up', label: 'Picked Up', icon: Package },
  { key: 'on_the_way', label: 'On the Way', icon: Navigation },
  { key: 'nearby', label: 'Nearby', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: Check },
];

export function TrackingPageClient({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone')?.trim() || undefined;
  const from = searchParams.get('from')?.trim() || undefined;

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTracking();
    
    // Auto-refresh every 30 seconds for active deliveries
    const interval = setInterval(() => {
      if (tracking?.tracking?.status && !['delivered', 'cancelled', 'returned'].includes(tracking.tracking.status)) {
        loadTracking(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [orderId, phone]);

  const loadTracking = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const qs =
        phone && phone.trim()
          ? `?phone=${encodeURIComponent(phone.trim())}`
          : '';
      const result = await apiClient.get<TrackingData>(`/customer/tracking/${orderId}${qs}`);
      setTracking(result);
      setError(null);
    } catch (err: any) {
      console.error('Error loading tracking:', err);
      if (!silent) setError(err.message || 'Failed to load tracking information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIndex = (status: string, steps: typeof statusSteps) => {
    // ✅ FIX: Map backend statuses to frontend step keys
    // Backend uses 'heading_to_pickup' when rider is assigned and heading to vendor
    // Frontend expects 'assigned' for "Rider Assigned" step
    const statusMap: Record<string, string> = {
      'heading_to_pickup': 'assigned', // Rider assigned and heading to pickup location
      'pending_assignment': 'pending_assignment',
      'assigned': 'assigned',
      'at_pickup': 'at_pickup',
      'picked_up': 'picked_up',
      'on_the_way': 'on_the_way',
      'nearby': 'nearby',
      'delivered': 'delivered',
    };
    
    const mappedStatus = statusMap[status] || status;
    const index = steps.findIndex(s => s.key === mappedStatus);
    return index >= 0 ? index : 0;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'Unable to find tracking information for this order.'}</p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const isHyperlocal = tracking.orderType === 'pharmacy' || tracking.orderType === 'meal';
  const steps = isHyperlocal ? deliveryStatusSteps : statusSteps;
  const trackingStatus = tracking.tracking?.status || (isHyperlocal ? 'pending_assignment' : 'pending');
  const currentStepIndex = getStatusIndex(trackingStatus, steps);
  const isDelivered = tracking.tracking?.status === 'delivered' || tracking.order.status === 'delivered';

  const mealBackHref =
    from === 'meal-plans' && phone
      ? `/orders/meal-plans?phone=${encodeURIComponent(phone)}`
      : '/';

  const orderTotal = tracking.order.total ?? tracking.order.total_amount;

  if (tracking.orderType === 'meal') {
    const logisticsStatus = tracking.tracking?.status ?? null;
    const otp = tracking.tracking?.deliveryOtp;
    const riderActive =
      logisticsStatus &&
      logisticsStatus !== 'pending_assignment' &&
      ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby'].includes(
        logisticsStatus
      );

    return (
      <MealPlanOrderTrackingUI
        orderDisplayId={formatMealOrderDisplayId(tracking.order)}
        orderStatus={tracking.order.status}
        logisticsStatus={logisticsStatus}
        totalAmount={orderTotal}
        backSlot={
          <a
            href={mealBackHref}
            className="p-2 rounded-full hover:bg-white/15 transition text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </a>
        }
        headerActions={
          <button
            type="button"
            onClick={() => loadTracking(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-white/15 text-white transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        }
        deliveryOtpBanner={
          otp &&
          riderActive &&
          !isDelivered ? (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 -mt-2 shadow-sm">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Handover OTP — share with delivery partner
              </p>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-3xl font-mono font-bold text-amber-900 tracking-[0.3em]">{otp}</span>
                <button
                  type="button"
                  onClick={() => otp && navigator.clipboard?.writeText(String(otp))}
                  className="px-4 py-2 bg-amber-200 text-amber-900 rounded-lg text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : undefined
        }
        deliveryPartnerCard={
          tracking.tracking?.deliveryPerson ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100/80">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full flex items-center justify-center shrink-0">
                  {tracking.tracking.deliveryPerson.photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tracking.tracking.deliveryPerson.photo}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <Truck className="w-7 h-7 text-teal-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{tracking.tracking.deliveryPerson.name}</p>
                  <p className="text-sm text-gray-500">
                    {tracking.tracking.deliveryPerson.vehicleNumber || 'Delivery partner'}
                  </p>
                </div>
                <a
                  href={`tel:${tracking.tracking.deliveryPerson.phone}`}
                  className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition shrink-0"
                  aria-label="Call delivery partner"
                >
                  <Phone className="w-5 h-5" />
                </a>
              </div>
              {tracking.tracking.eta ? (
                <div className="mt-4 flex items-center gap-3 p-3 bg-teal-50 rounded-xl border border-teal-100">
                  <Clock className="w-5 h-5 text-teal-600 shrink-0" />
                  <p className="text-sm font-medium text-teal-900">
                    Arriving in ~{tracking.tracking.eta} minutes
                  </p>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
        deliveredBanner={
          isDelivered ? (
            <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 text-white text-center shadow-sm border border-white/20">
              <CheckCircle className="w-14 h-14 mx-auto mb-3 opacity-95" />
              <h2 className="text-xl font-bold mb-1">Delivered!</h2>
              <p className="text-sm text-white/90">
                {tracking.tracking?.deliveredAt
                  ? `Delivered ${formatDate(tracking.tracking.deliveredAt)}`
                  : 'Your meal plan order has been delivered.'}
              </p>
              <a
                href="/support"
                className="inline-block mt-4 text-sm font-semibold text-white underline underline-offset-2 hover:text-white/90"
              >
                Need help?
              </a>
            </div>
          ) : undefined
        }
        floatingChatButton={
          <a
            href="/support"
            className="w-14 h-14 bg-white shadow-lg rounded-full flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition"
            aria-label="Help"
          >
            <MessageCircle className="w-7 h-7 text-slate-600" />
          </a>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <a
            href={
              from === 'meal-plans' && phone
                ? `/orders/meal-plans?phone=${encodeURIComponent(phone)}`
                : '/'
            }
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </a>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
          <button 
            onClick={() => loadTracking(true)}
            disabled={refreshing}
            className="p-2 -mr-2 hover:bg-gray-100 rounded-xl transition"
          >
            <RefreshCcw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Order Info Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Order #{tracking.order.orderNumber}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">₹{tracking.order.total?.toLocaleString()}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isDelivered 
                ? 'bg-green-100 text-green-700' 
                : 'bg-orange-100 text-orange-700'
            }`}>
              {tracking.tracking?.status?.replace(/_/g, ' ') || tracking.order.status}
            </span>
          </div>
          
          {tracking.tracking?.awb && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Package className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">AWB Number</p>
                <p className="font-mono font-medium text-gray-900">{tracking.tracking.awb}</p>
              </div>
              {tracking.tracking.courier && (
                <span className="text-sm text-gray-600">{tracking.tracking.courier}</span>
              )}
            </div>
          )}
        </div>

        {/* Delivery Person Card (Hyperlocal) */}
        {isHyperlocal && tracking.tracking?.deliveryPerson && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center">
                {tracking.tracking.deliveryPerson.photo ? (
                  <img 
                    src={tracking.tracking.deliveryPerson.photo} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Truck className="w-7 h-7 text-orange-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{tracking.tracking.deliveryPerson.name}</p>
                <p className="text-sm text-gray-500">
                  {tracking.tracking.deliveryPerson.vehicleNumber || 'Delivery Partner'}
                </p>
              </div>
              <a 
                href={`tel:${tracking.tracking.deliveryPerson.phone}`}
                className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition"
              >
                <Phone className="w-5 h-5" />
              </a>
            </div>

            {tracking.tracking.eta && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Arriving in ~{tracking.tracking.eta} minutes
                  </p>
                  {tracking.tracking.distanceRemaining && (
                    <p className="text-xs text-blue-600">
                      {tracking.tracking.distanceRemaining.toFixed(1)} km away
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Steps */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-6">Delivery Progress</h3>
          
          <div className="relative">
            {steps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const Icon = step.icon;
              
              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {/* Line */}
                  {index < steps.length - 1 && (
                    <div 
                      className={`absolute left-5 top-10 w-0.5 h-8 ${
                        index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted 
                      ? isCurrent 
                        ? 'bg-orange-500 text-white ring-4 ring-orange-100' 
                        : 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Text */}
                  <div className={`pb-8 ${isCurrent ? 'font-medium' : ''}`}>
                    <p className={isCompleted ? 'text-gray-900' : 'text-gray-400'}>
                      {step.label}
                    </p>
                    {isCurrent && !isDelivered && (
                      <p className="text-sm text-orange-600 mt-1">Current Status</p>
                    )}
                    {step.key === 'delivered' && isDelivered && tracking.tracking?.deliveredAt && (
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(tracking.tracking.deliveredAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracking Events (E-commerce) */}
        {tracking.tracking?.events && tracking.tracking.events.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-4">Tracking History</h3>
            
            <div className="space-y-4">
              {tracking.tracking.events.map((event, index) => (
                <div key={index} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-2 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{event.description || event.event}</p>
                    {event.location && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(event.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Delivery */}
        {tracking.tracking?.estimatedDelivery && !isDelivered && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-xl">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Estimated Delivery</p>
                <p className="text-lg font-bold text-blue-900">
                  {new Date(tracking.tracking.estimatedDelivery).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* External Tracking Link */}
        {tracking.tracking?.trackingUrl && (
          <a 
            href={tracking.tracking.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white rounded-2xl border hover:border-orange-300 hover:shadow-sm transition"
          >
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-900">View on Courier Website</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </a>
        )}

        {/* Need Help */}
        <div className="text-center pt-4">
          <p className="text-sm text-gray-500 mb-2">Need help with your order?</p>
          <a 
            href="/support"
            className="text-orange-600 font-medium hover:underline"
          >
            Contact Support
          </a>
        </div>
      </main>
    </div>
  );
}
