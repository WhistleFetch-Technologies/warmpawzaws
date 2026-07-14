"use client";

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, Package, Truck, CheckCircle, Clock, 
  Navigation, ChevronDown, Star, ArrowLeft,
  AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadMealOrderInvoice,
  getMealOrderInvoiceDownloadMessage,
  isMealOrderInvoiceAvailable,
} from '@/lib/meal-order-invoice-download';
import { apiClient } from '@/lib/api-client';
import { MealTrackingMealView } from '@/components/customer/tracking/MealTrackingMealView';
import { MealTrackingBackButton } from '@/components/customer/tracking/MealTrackingHeader';
import { MealTrackingInvoiceButton } from '@/components/customer/tracking/MealTrackingInvoiceButton';
import { DeliveryPartnerCallAction } from '@/components/customer/tracking/DeliveryPartnerCallAction';
import { useMealTrackingPoll } from '@/lib/use-meal-tracking-poll';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { MealPlansComingSoon } from '@/components/customer/nutrition/MealPlansComingSoon';
import {
  buildSupportMealOrderContext,
  navigateToMealOrderSupport,
  type SupportMealOrderContext,
} from '@/lib/support-contact';
import { resolveMealOrderRowId } from '@/lib/meal-order-tracking-nav';

interface DeliveryPerson {
  name: string;
  phone: string;
  photo?: string;
  vehicle_number?: string;
  vehicleNumber?: string;
}

interface TrackingData {
  status: string;
  reassignPending?: boolean;
  lastLocationUpdate?: string;
  deliveryOtp?: string | null;
  deliveredAt?: string | null;
  currentLat?: number;
  currentLng?: number;
  eta?: number;
  etaMinutes?: number;
  distanceRemaining?: number;
  logistics_partner?: string;
  logisticsPartner?: string;
  deliveryPerson?: DeliveryPerson;
  rider?: DeliveryPerson & { vehicleType?: string };
  currentLocation?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  location?: { latitude?: number; longitude?: number };
}

interface OrderTrackingScreenProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  onBack?: () => void;
  /** Opens Help & Support with this meal order pre-linked (in-app shell). */
  onNeedHelp?: (ctx: SupportMealOrderContext) => void;
}

const statusSteps = [
  { key: 'accepted', label: 'Order Confirmed', icon: CheckCircle, color: 'green' },
  { key: 'preparing', label: 'Preparing', icon: Package, color: 'blue' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package, color: 'purple' },
  { key: 'picked_up', label: 'Picked Up', icon: Truck, color: 'orange' },
  { key: 'on_the_way', label: 'On the Way', icon: Navigation, color: 'orange' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' },
];

export function OrderTrackingScreen({ orderId, orderType, onBack, onNeedHelp }: OrderTrackingScreenProps) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [mealCustomer, setMealCustomer] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const orderRef = useRef<any>(null);
  const trackingRef = useRef<TrackingData | null>(null);

  const loadOrderAndTracking = useCallback(async () => {
    try {
      if (orderType === 'meal') {
        const response = await apiClient.get(`/customer/tracking/${orderId}`) as any;
        if (response.success) {
          setOrder(response.order);
          setTracking(response.tracking);
          setMealCustomer(response.customer ?? null);
          orderRef.current = response.order;
          trackingRef.current = response.tracking;
        }
      } else {
        const response = await apiClient.get(`/pharmacy/orders/${orderId}`) as any;
        if (response.success) {
          setOrder(response.order);
          setTracking(response.tracking);
          orderRef.current = response.order;
          trackingRef.current = response.tracking;
        }
      }
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId, orderType]);

  useMealTrackingPoll(
    loadOrderAndTracking,
    () => ({
      orderStatus: orderRef.current?.status ?? null,
      logisticsStatus: trackingRef.current?.status ?? null,
    }),
    [orderId, orderType],
  );

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const status = order.status || tracking?.status;
    const idx = statusSteps.findIndex(s => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const formatETA = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    // ✅ FIX: Show hours when >= 60 minutes
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hrs}h ${mins}m`;
    }
  };

  if (orderType === 'meal' && !isCustomerMealPlansEnabled()) {
    return (
      <MealPlansComingSoon
        onBack={onBack}
        title="Order tracking"
        subtitle="Live meal delivery tracking"
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Order Not Found</h2>
        <p className="text-gray-600 text-center">
          We couldn&apos;t find this order. It may have been cancelled.
        </p>
        <button onClick={onBack} className="mt-6 text-green-600 font-medium">
          Go Back
        </button>
      </div>
    );
  }

  if (orderType === 'meal') {
    const reassignPending = Boolean(tracking?.reassignPending);
    const openMealOrderHelp = () => {
      const ctx = buildSupportMealOrderContext(order as Record<string, unknown>);
      if (onNeedHelp) {
        onNeedHelp(ctx);
      } else {
        navigateToMealOrderSupport(router, ctx);
      }
    };
    const handleDownloadInvoice = async () => {
      if (!isMealOrderInvoiceAvailable(order as Record<string, unknown>)) {
        toast.error('Invoice is available after payment is confirmed');
        return;
      }
      const invoiceOrderId =
        resolveMealOrderRowId(order as { id?: string; order_id?: string; orderId?: string }) ||
        orderId;
      try {
        const { saveResult } = await downloadMealOrderInvoice(invoiceOrderId);
        if (saveResult === 'failed') {
          toast.error(getMealOrderInvoiceDownloadMessage(saveResult));
        } else {
          toast.success(getMealOrderInvoiceDownloadMessage(saveResult));
        }
      } catch (err: unknown) {
        console.error('[OrderTrackingScreen] invoice download failed:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to download invoice');
      }
    };

    return (
      <MealTrackingMealView
        order={order as Record<string, unknown>}
        customer={mealCustomer}
        tracking={(tracking as unknown as Record<string, unknown>) ?? null}
        orderId={orderId}
        reassignPending={reassignPending}
        backSlot={<MealTrackingBackButton onClick={onBack} />}
        onSupport={openMealOrderHelp}
        headerExtra={
          isMealOrderInvoiceAvailable(order as Record<string, unknown>) ? (
            <MealTrackingInvoiceButton onClick={() => void handleDownloadInvoice()} />
          ) : undefined
        }
      />
    );
  }

  const currentStepIdx = getCurrentStepIndex();
  const isDelivered = order.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold">Track Order</h1>
            <p className="text-sm text-white/80">#{order.order_number || order.orderNumber || order.id?.slice(-8)}</p>
          </div>
        </div>
        
        {/* ETA Banner */}
        {!isDelivered && (tracking?.eta ?? tracking?.etaMinutes) && (
          <div className="bg-white/20 backdrop-blur rounded-xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm text-white/80">Arriving in</p>
              <p className="text-2xl font-bold">{formatETA(tracking.eta ?? tracking.etaMinutes ?? 0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Live Map Placeholder */}
      {!isDelivered && (
        <div className="relative h-48 bg-gradient-to-br from-green-100 to-teal-100">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 bg-white rounded-full shadow-lg flex items-center justify-center">
                {order.status === 'on_the_way' || order.status === 'picked_up' ? (
                  <Truck className="w-8 h-8 text-orange-500 animate-bounce" />
                ) : (
                  <Package className="w-8 h-8 text-green-500" />
                )}
              </div>
              <p className="text-sm text-gray-600 font-medium">
                {order.status === 'on_the_way' ? 'Your order is on the way!' : 
                 order.status === 'preparing' ? 'Being prepared...' :
                 order.status === 'ready_for_pickup' ? 'Ready for pickup' :
                 'Processing...'}
              </p>
            </div>
          </div>
          
          {/* Pulse Animation for Live Tracking */}
          {(order.status === 'on_the_way' || order.status === 'picked_up') && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-24 h-24 rounded-full border-4 border-orange-400 animate-ping opacity-30" />
            </div>
          )}
        </div>
      )}

      {/* Phase 4: Delivery OTP – show when out for delivery */}
      {!isDelivered && tracking?.deliveryOtp && (order?.status === 'on_the_way' || order?.status === 'picked_up' || tracking?.status === 'on_the_way' || tracking?.status === 'picked_up') && (
        <div className="mx-4 mt-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">Handover OTP – share with delivery partner</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-3xl font-mono font-bold text-amber-900 tracking-[0.3em]">{tracking.deliveryOtp}</span>
              <button
                type="button"
                onClick={() => tracking.deliveryOtp && navigator.clipboard?.writeText(tracking.deliveryOtp)}
                className="px-4 py-2 bg-amber-200 text-amber-900 rounded-lg text-sm font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Person Card */}
      {tracking?.deliveryPerson && !isDelivered && (
        <div className="mx-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {tracking.deliveryPerson.name?.charAt(0) || 'D'}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{tracking.deliveryPerson.name}</p>
              <p className="text-sm text-gray-500">
                {tracking.deliveryPerson.vehicle_number || 'Delivery Partner'}
              </p>
            </div>
            {tracking.deliveryPerson.phone ? (
              <DeliveryPartnerCallAction phone={tracking.deliveryPerson.phone} variant="icon" />
            ) : null}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="p-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
          <div className="space-y-4">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIdx;
              const isCurrent = index === currentStepIdx;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`relative flex-shrink-0`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-green-100' : ''}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {/* Connecting line */}
                    {index < statusSteps.length - 1 && (
                      <div className={`absolute left-5 top-10 w-0.5 h-8 ${
                        isCompleted && index < currentStepIdx ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {isCurrent && order[`${step.key}_at`] && (
                      <p className="text-sm text-gray-500">
                        {new Date(order[`${step.key}_at`]).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                    {isCurrent && step.key === 'on_the_way' && (tracking?.eta ?? tracking?.etaMinutes) && (
                      <p className="text-sm text-orange-500 font-medium mt-1">
                        ETA: {formatETA(tracking.eta ?? tracking.etaMinutes ?? 0)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivered Success */}
      {isDelivered && (
        <div className="mx-4 mb-4">
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 text-white text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Delivered!</h2>
            <p className="text-sm text-white/80 mb-4">
              Delivered at {order.delivered_at ? new Date(order.delivered_at).toLocaleTimeString('en-IN') : 'N/A'}
            </p>
            <button className="bg-white text-green-600 px-6 py-2 rounded-full font-medium flex items-center gap-2 mx-auto">
              <Star className="w-4 h-4" />
              Rate Your Experience
            </button>
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="p-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
        >
          <span className="font-semibold text-gray-900">Order Details</span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        {showDetails && (
          <div className="bg-white rounded-b-2xl shadow-sm px-4 pb-4 -mt-2 pt-2 border-t">
            {/* Items */}
            <div className="space-y-2 mb-4">
              {(typeof order.items === 'string' ? JSON.parse(order.items) : order.items)?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.medicine_name || item.name} x{item.quantity}</span>
                  <span className="text-gray-900">₹{item.quantity * item.unit_price}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span>₹{order.delivery_fee}</span>
              </div>
              {order.platform_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fee</span>
                  <span>₹{order.platform_fee}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="text-green-600">₹{order.total_amount}</span>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                  <p className="text-sm text-gray-600">
                    {typeof order.delivery_address === 'string' 
                      ? JSON.parse(order.delivery_address).address 
                      : order.delivery_address?.address}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
