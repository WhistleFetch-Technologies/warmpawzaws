"use client";

import { useState, useEffect } from 'react';
import { 
  MapPin, Package, Truck, CheckCircle, Clock, Phone, 
  MessageCircle, Navigation, ChevronDown, Star, ArrowLeft,
  AlertCircle, Loader2, X
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeliveryPerson {
  name: string;
  phone: string;
  photo?: string;
  vehicle_number?: string;
}

interface TrackingData {
  status: string;
  deliveryOtp?: string | null;
  currentLat?: number;
  currentLng?: number;
  eta?: number;
  etaMinutes?: number;
  deliveryPerson?: DeliveryPerson;
}

interface OrderTrackingScreenProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  onBack?: () => void;
}

const statusSteps = [
  { key: 'accepted', label: 'Order Confirmed', icon: CheckCircle, color: 'green' },
  { key: 'preparing', label: 'Preparing', icon: Package, color: 'blue' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package, color: 'purple' },
  { key: 'picked_up', label: 'Picked Up', icon: Truck, color: 'orange' },
  { key: 'on_the_way', label: 'On the Way', icon: Navigation, color: 'orange' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' },
];

export function OrderTrackingScreen({ orderId, orderType, onBack }: OrderTrackingScreenProps) {
  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    loadOrderAndTracking();
    const interval = setInterval(loadOrderAndTracking, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const loadOrderAndTracking = async () => {
    try {
      if (orderType === 'meal') {
        const response = await apiClient.get(`/customer/tracking/${orderId}`) as any;
        if (response.success) {
          setOrder(response.order);
          setTracking(response.tracking);
        }
      } else {
        const response = await apiClient.get(`/pharmacy/orders/${orderId}`) as any;
        if (response.success) {
          setOrder(response.order);
          setTracking(response.tracking);
        }
      }
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const status = order.status || tracking?.status;
    const idx = statusSteps.findIndex(s => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const formatETA = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const submitReview = async () => {
    if (orderType !== 'meal' || reviewRating < 1 || reviewRating > 5) return;
    setReviewSubmitting(true);
    try {
      await apiClient.post(`/meal/orders/${orderId}/review`, {
        rating: reviewRating,
        review: reviewText || undefined,
      });
      setReviewSubmitted(true);
      setShowReviewModal(false);
      setOrder((prev: any) => prev ? { ...prev, rating: reviewRating, review: reviewText } : prev);
    } catch (err) {
      console.error('Submit review error:', err);
    } finally {
      setReviewSubmitting(false);
    }
  };

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
            <div className="flex gap-2">
              <a
                href={`tel:${tracking.deliveryPerson.phone}`}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
              <button className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </button>
            </div>
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
            {orderType === 'meal' && !order.rating && !reviewSubmitted ? (
              <button
                onClick={() => setShowReviewModal(true)}
                className="bg-white text-green-600 px-6 py-2 rounded-full font-medium flex items-center gap-2 mx-auto"
              >
                <Star className="w-4 h-4" />
                Rate Your Experience
              </button>
            ) : (orderType === 'meal' && (order.rating || reviewSubmitted)) ? (
              <p className="text-sm text-white/90 flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-current" /> Thank you for your review!
              </p>
            ) : (
              <button className="bg-white text-green-600 px-6 py-2 rounded-full font-medium flex items-center gap-2 mx-auto">
                <Star className="w-4 h-4" />
                Rate Your Experience
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review modal (meal orders only) */}
      {showReviewModal && orderType === 'meal' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Rate Your Experience</h3>
              <button onClick={() => setShowReviewModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className={`p-2 rounded-full ${reviewRating >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  <Star className={`w-6 h-6 ${reviewRating >= n ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Optional: share your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 mb-4"
              maxLength={500}
            />
            <button
              onClick={submitReview}
              disabled={reviewSubmitting || reviewRating < 1}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {reviewSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Submit Review
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

      {/* Help Button */}
      <div className="fixed bottom-6 right-6">
        <button className="w-14 h-14 bg-white shadow-lg rounded-full flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
