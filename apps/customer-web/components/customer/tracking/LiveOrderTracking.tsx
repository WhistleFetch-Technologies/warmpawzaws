"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapPin, Package, Truck, CheckCircle, Clock, Phone, 
  Navigation, ChevronDown, Star, ArrowLeft,
  AlertCircle, Loader2, User, Bike
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { isTerminalDeliveryState } from '@warmpawz/shared-types';
import { MEAL_TRACKING_POLL_MS } from '@/lib/meal-tracking-utils';
import { LiveTrackingMapPanel } from '@/components/customer/tracking/LiveTrackingMapPanel';
import { DeliveryPartnerCallAction } from '@/components/customer/tracking/DeliveryPartnerCallAction';

interface DeliveryPerson {
  name: string;
  phone: string;
  photo?: string;
  vehicleNumber?: string;
}

interface TrackingData {
  id: string;
  status: string;
  deliveryPerson: DeliveryPerson;
  currentLocation: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
  eta: number;
  distanceRemaining: number;
  timestamps: {
    assigned: string;
    reachedPickup: string;
    pickedUp: string;
    delivered: string;
  };
}

interface LiveOrderTrackingProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  deliveryAddress: { lat: number; lng: number; address: string };
  onBack?: () => void;
}

export function LiveOrderTracking({ 
  orderId, 
  orderType, 
  deliveryAddress,
  onBack 
}: LiveOrderTrackingProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const statusRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadTracking = useCallback(async () => {
    try {
      const response = await apiClient.get(`/delivery/order/${orderType}/${orderId}`) as any;
      if (response.success) {
        setTracking(response.tracking);
        statusRef.current = response.tracking?.status ?? null;
        if (isTerminalDeliveryState(statusRef.current)) {
          stopPolling();
        }
      }
    } catch (error) {
      console.error('Error loading tracking:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId, orderType, stopPolling]);

  useEffect(() => {
    void loadTracking();
    intervalRef.current = setInterval(() => {
      if (isTerminalDeliveryState(statusRef.current)) {
        stopPolling();
        return;
      }
      void loadTracking();
    }, MEAL_TRACKING_POLL_MS);

    return () => stopPolling();
  }, [loadTracking, stopPolling]);

  const getStatusStep = (status: string): number => {
    const steps = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby', 'delivered'];
    return steps.indexOf(status);
  };

  const formatETA = (minutes: number): string => {
    if (!minutes) return '--';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Waiting for Pickup</h2>
        <p className="text-gray-600 text-center">
          Your order is being prepared. Tracking will start once it&apos;s picked up.
        </p>
        <button onClick={onBack} className="mt-6 text-orange-600 font-medium">
          Go Back
        </button>
      </div>
    );
  }

  const currentStep = getStatusStep(tracking.status);
  const isDelivered = tracking.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with ETA */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold">Live Tracking</h1>
            <p className="text-sm text-white/80">
              {isDelivered ? 'Order Delivered!' : tracking.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
          </div>
        </div>

        {/* ETA Card */}
        {!isDelivered && tracking.eta && (
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 flex items-center gap-4">
            <div className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="text-sm text-white/80">Arriving in</p>
              <p className="text-3xl font-bold">{formatETA(tracking.eta)}</p>
            </div>
            {tracking.distanceRemaining > 0 && (
              <div className="ml-auto text-right">
                <p className="text-sm text-white/80">Distance</p>
                <p className="text-xl font-semibold">{tracking.distanceRemaining.toFixed(1)} km</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map — hide after terminal delivery states */}
      {!isTerminalDeliveryState(tracking.status) && tracking.currentLocation ? (
      <div className="relative -mt-4 px-0">
        <LiveTrackingMapPanel
          variant="pharmacy"
          deliveryAddress={deliveryAddress}
          currentLocation={{
            lat: tracking.currentLocation.lat,
            lng: tracking.currentLocation.lng,
          }}
          etaMinutes={tracking.eta}
          distanceRemainingKm={tracking.distanceRemaining}
          className="rounded-t-3xl border-0 shadow-none"
        />
      </div>
      ) : null}

      {/* Delivery Person Card */}
      {tracking.deliveryPerson && !isDelivered && (
        <div className="mx-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {tracking.deliveryPerson.photo ? (
                <img 
                  src={tracking.deliveryPerson.photo} 
                  alt={tracking.deliveryPerson.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                tracking.deliveryPerson.name?.charAt(0) || <User className="w-7 h-7" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{tracking.deliveryPerson.name}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Bike className="w-4 h-4" />
                <span>{tracking.deliveryPerson.vehicleNumber || 'Delivery Partner'}</span>
              </div>
            </div>
            {tracking.deliveryPerson.phone ? (
              <DeliveryPartnerCallAction phone={tracking.deliveryPerson.phone} variant="icon" />
            ) : null}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="p-4 mt-4">
        <h3 className="font-semibold text-gray-900 mb-4">Delivery Status</h3>
        <div className="space-y-0">
          {[
            { key: 'picked_up', label: 'Picked Up', icon: Package },
            { key: 'on_the_way', label: 'On The Way', icon: Truck },
            { key: 'nearby', label: 'Nearby', icon: MapPin },
            { key: 'delivered', label: 'Delivered', icon: CheckCircle },
          ].map((step, index) => {
            const stepIndex = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby', 'delivered'].indexOf(step.key);
            const isCompleted = currentStep >= stepIndex;
            const isCurrent = currentStep === stepIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-start gap-4">
                {/* Icon & Line */}
                <div className="relative flex-shrink-0 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-100 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-100 scale-110' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {index < 3 && (
                    <div className={`w-0.5 h-12 ${
                      isCompleted && currentStep > stepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-sm text-orange-500 font-medium mt-0.5 flex items-center gap-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      In Progress
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivered Success */}
      {isDelivered && (
        <div className="mx-4 mb-4">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Delivered!</h2>
            <p className="text-sm text-white/80 mb-4">
              Enjoy your {orderType === 'pharmacy' ? 'medicines' : 'meal'}!
            </p>
            <button className="bg-white text-green-600 px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 mx-auto active:scale-95 transition-transform">
              <Star className="w-5 h-5" />
              Rate Delivery
            </button>
          </div>
        </div>
      )}

      {/* Delivery Address */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivering to</p>
              <p className="font-medium text-gray-900">{deliveryAddress.address}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
