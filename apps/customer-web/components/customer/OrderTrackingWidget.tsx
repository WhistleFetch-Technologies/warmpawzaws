'use client';

/**
 * ============================================================================
 * ORDER TRACKING WIDGET COMPONENT
 * ============================================================================
 * 
 * Zomato-like tracking widget for pharmacy/meal orders
 * - Fixed bottom card
 * - Progress steps timeline
 * - Map preview
 * - ETA display
 * - Live tracking button
 * 
 * Phase: Phase 4 - Pharmacy & Delivery Flow
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { MapPin, Clock, Package, CheckCircle2, Circle, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface OrderTrackingWidgetProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  onClose?: () => void;
  onTrackLive?: () => void;
}

const TRACKING_STEPS = [
  { id: 'accepted', label: 'Order Accepted', icon: CheckCircle2 },
  { id: 'preparing', label: 'Preparing', icon: Package },
  { id: 'ready', label: 'Ready for Pickup', icon: Package },
  { id: 'picked_up', label: 'Picked Up', icon: Navigation },
  { id: 'on_the_way', label: 'On The Way', icon: Navigation },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export function OrderTrackingWidget({
  orderId,
  orderType,
  onClose,
  onTrackLive,
}: OrderTrackingWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<any>(null);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    loadTracking();
    const interval = setInterval(loadTracking, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const loadTracking = async () => {
    try {
      const endpoint = orderType === 'meal'
        ? `/customer/tracking/${orderId}`
        : `/pharmacy/orders/${orderId}/tracking`;
      const response = await apiClient.get(endpoint) as any;
      if (response.success) {
        const tr = response.tracking || response;
        setTracking(tr);
        setEta(tr?.eta ?? tr?.etaToDelivery ?? null);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error loading tracking:', error);
      setLoading(false);
    }
  };

  if (loading || !tracking) {
    return null;
  }

  const statusForStep = tracking.status === 'confirmed' ? 'accepted' : tracking.status === 'ready_for_pickup' ? 'ready' : tracking.status;
  const currentStepIndex = TRACKING_STEPS.findIndex(step => step.id === statusForStep);
  const isActive = ['picked_up', 'on_the_way'].includes(tracking.status);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t-2 border-gray-200 shadow-2xl max-w-[430px] mx-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FF8C42]" />
            <div>
              <div className="font-semibold text-gray-900">Order Tracking</div>
              <div className="text-xs text-gray-600">
                {orderType === 'pharmacy' ? 'Medicine Delivery' : 'Meal Delivery'}
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="space-y-2">
          {TRACKING_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-[#FF8C42] text-white' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`flex-1 text-sm ${
                  isCompleted ? 'text-green-600 font-medium' :
                  isCurrent ? 'text-[#FF8C42] font-semibold' :
                  'text-gray-400'
                }`}>
                  {step.label}
                </div>
                {isCurrent && index < TRACKING_STEPS.length - 1 && (
                  <div className="w-16 h-0.5 bg-gray-200" />
                )}
              </div>
            );
          })}
        </div>

        {/* ETA */}
        {eta && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-600" />
            <div>
              <div className="text-sm font-medium text-orange-900">
                Estimated arrival: {eta} minutes
              </div>
              <div className="text-xs text-orange-700">
                {tracking.deliveryPerson?.name ? `Delivered by ${tracking.deliveryPerson.name}` : 'On the way'}
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Delivery OTP – show when out for delivery */}
        {isActive && tracking.deliveryOtp && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="text-xs font-medium text-amber-800 mb-1">Handover OTP</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-mono font-bold text-amber-900 tracking-widest">{tracking.deliveryOtp}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(tracking.deliveryOtp)}
                className="text-xs text-amber-700 font-medium"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-1">Share with delivery partner at handover</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isActive && (
            <Button
              onClick={onTrackLive}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Track Live
            </Button>
          )}
          {tracking.deliveryPerson?.phone && (
            <Button
              onClick={() => window.open(`tel:${tracking.deliveryPerson.phone}`, '_self')}
              variant="outline"
              className="border-2 border-gray-200"
            >
              Call
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
