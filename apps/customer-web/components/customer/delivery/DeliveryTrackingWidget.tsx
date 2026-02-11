'use client';

/**
 * ============================================================================
 * DELIVERY TRACKING & OTP CONFIRMATION WIDGET
 * ============================================================================
 * 
 * Real-time delivery tracking with OTP verification for delivery confirmation
 * - Live ETA updates
 * - Delivery partner info
 * - Order status timeline
 * - OTP verification on delivery
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, MapPin, Phone, MessageSquare, Clock, Truck,
  Check, CheckCircle2, Circle, Copy, RefreshCw, X,
  AlertCircle, User, Navigation, Loader2, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface DeliveryTrackingWidgetProps {
  orderId: string;
  orderType: 'pharmacy' | 'food' | 'product';
  onComplete?: () => void;
  onClose?: () => void;
  className?: string;
}

interface DeliveryStatus {
  orderId: string;
  status: 'placed' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'on_way' | 'arriving' | 'delivered';
  partnerName?: string;
  partnerPhone?: string;
  partnerPhotoUrl?: string;
  vehicleNumber?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  etaMinutes?: number;
  distanceKm?: number;
  deliveryOtp?: string;
  otpVerified?: boolean;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    message?: string;
  }>;
}

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: Check },
  { key: 'preparing', label: 'Preparing', icon: Clock },
  { key: 'ready', label: 'Ready for Pickup', icon: Package },
  { key: 'picked_up', label: 'Picked Up', icon: Truck },
  { key: 'on_way', label: 'On the Way', icon: Navigation },
  { key: 'arriving', label: 'Arriving', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export function DeliveryTrackingWidget({
  orderId,
  orderType,
  onComplete,
  onClose,
  className = '',
}: DeliveryTrackingWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDeliveryStatus();
    startPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [orderId]);

  const loadDeliveryStatus = async () => {
    try {
      const res = await apiClient.get<any>(`/delivery/${orderId}/status`);
      if (res.success || res.status) {
        setStatus({
          orderId,
          status: res.status || res.delivery_status || 'placed',
          partnerName: res.partner_name || res.partnerName,
          partnerPhone: res.partner_phone || res.partnerPhone,
          partnerPhotoUrl: res.partner_photo_url || res.partnerPhotoUrl,
          vehicleNumber: res.vehicle_number || res.vehicleNumber,
          currentLocation: res.current_location || res.currentLocation,
          destination: res.destination,
          etaMinutes: res.eta_minutes || res.etaMinutes,
          distanceKm: res.distance_km || res.distanceKm,
          deliveryOtp: res.delivery_otp || res.deliveryOtp || res.otp,
          otpVerified: res.otp_verified || res.otpVerified,
          statusHistory: res.status_history || res.statusHistory || [],
        });
      }
    } catch (error) {
      console.error('Error loading delivery status:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get<any>(`/delivery/${orderId}/status`);
        if (res.success || res.status) {
          const newStatus = res.status || res.delivery_status;
          
          // Check if delivered
          if (newStatus === 'delivered') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            toast.success('Order delivered successfully!');
            onComplete?.();
          }

          setStatus(prev => prev ? {
            ...prev,
            status: newStatus,
            partnerName: res.partner_name || res.partnerName || prev.partnerName,
            partnerPhone: res.partner_phone || res.partnerPhone || prev.partnerPhone,
            currentLocation: res.current_location || res.currentLocation,
            etaMinutes: res.eta_minutes || res.etaMinutes,
            distanceKm: res.distance_km || res.distanceKm,
            statusHistory: res.status_history || res.statusHistory || prev.statusHistory,
          } : null);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 10000); // Poll every 10 seconds
  };

  const copyOTP = () => {
    if (status?.deliveryOtp) {
      navigator.clipboard.writeText(status.deliveryOtp);
      setCopiedOTP(true);
      toast.success('OTP copied!');
      setTimeout(() => setCopiedOTP(false), 2000);
    }
  };

  const verifyOTP = async () => {
    if (!otpInput.trim() || otpInput.length !== 4) {
      toast.error('Please enter 4-digit OTP');
      return;
    }

    setVerifying(true);
    try {
      const res = await apiClient.post<any>(`/delivery/${orderId}/verify-otp`, {
        otp: otpInput,
      });

      if (res.success) {
        toast.success('Delivery confirmed!');
        setStatus(prev => prev ? { ...prev, otpVerified: true, status: 'delivered' } : null);
        onComplete?.();
      } else {
        toast.error(res.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusIndex = (currentStatus: string) => {
    return STATUS_STEPS.findIndex(s => s.key === currentStatus);
  };

  const formatETA = (minutes?: number) => {
    if (!minutes) return 'Calculating...';
    if (minutes < 1) return 'Arriving now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    // ✅ FIX: Show hours when >= 60 minutes
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  if (loading) {
    return (
      <Card className={`bg-white rounded-2xl p-6 border border-gray-100 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
        </div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className={`bg-white rounded-2xl p-6 border border-gray-100 ${className}`}>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Unable to load delivery status</p>
          <Button onClick={loadDeliveryStatus} variant="outline" size="sm" className="mt-3">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const currentStatusIndex = getStatusIndex(status.status);
  const isOutForDelivery = ['picked_up', 'on_way', 'arriving'].includes(status.status);

  return (
    <Card className={`bg-white rounded-2xl overflow-hidden border border-gray-100 ${className}`}>
      {/* Header with ETA */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7029] p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Estimated Arrival</p>
            <p className="text-2xl font-bold">{formatETA(status.etaMinutes)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-0">
              {status.status === 'delivered' ? 'Delivered' : 'In Progress'}
            </Badge>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        
        {status.distanceKm && status.status !== 'delivered' && (
          <p className="text-white/70 text-sm mt-1">
            {status.distanceKm.toFixed(1)} km away
          </p>
        )}
      </div>

      {/* Delivery Partner Info */}
      {status.partnerName && isOutForDelivery && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {status.partnerPhotoUrl ? (
                  <img src={status.partnerPhotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{status.partnerName}</p>
                {status.vehicleNumber && (
                  <p className="text-sm text-gray-500">{status.vehicleNumber}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {status.partnerPhone && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = `tel:${status.partnerPhone}`}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm">
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Section */}
      {status.deliveryOtp && isOutForDelivery && !status.otpVerified && (
        <div className="p-4 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-orange-800">Delivery OTP</span>
              </div>
              <p className="text-xs text-orange-600">
                Share this with delivery partner to confirm delivery
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOTP(!showOTP)}
                className="font-mono text-2xl font-bold text-orange-600 tracking-wider"
              >
                {showOTP ? status.deliveryOtp : '****'}
              </button>
              <button
                onClick={copyOTP}
                className="p-2 hover:bg-orange-100 rounded-lg transition"
              >
                {copiedOTP ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-orange-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
        <div className="relative">
          {STATUS_STEPS.slice(0, currentStatusIndex + 2).map((step, idx) => {
            const isCompleted = idx <= currentStatusIndex;
            const isCurrent = idx === currentStatusIndex;
            const StepIcon = step.icon;
            
            // Get timestamp from history
            const historyItem = status.statusHistory.find(h => h.status === step.key);
            
            return (
              <div key={step.key} className="flex items-start gap-3 pb-4 last:pb-0">
                {/* Icon */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted 
                    ? 'bg-green-100 text-green-600' 
                    : isCurrent 
                    ? 'bg-[#FF8C42] text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  <StepIcon className="w-4 h-4" />
                </div>
                
                {/* Line */}
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`absolute left-4 w-0.5 h-8 -translate-x-1/2 ${
                    isCompleted ? 'bg-green-200' : 'bg-gray-200'
                  }`} style={{ top: `${idx * 48 + 32}px` }} />
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    isCompleted ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </p>
                  {historyItem && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(historyItem.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {historyItem.message && ` • ${historyItem.message}`}
                    </p>
                  )}
                </div>
                
                {/* Status indicator */}
                {isCurrent && !isCompleted && (
                  <div className="w-2 h-2 bg-[#FF8C42] rounded-full animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivered state with OTP verification (for delivery partner app) */}
      {status.status === 'arriving' && (
        <div className="p-4 border-t border-gray-100">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-blue-800 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Your delivery partner is arriving. Please keep the OTP ready for verification.
            </p>
          </div>
        </div>
      )}

      {/* Delivery completed */}
      {status.status === 'delivered' && (
        <div className="p-4 border-t border-gray-100">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Order Delivered!</p>
            <p className="text-green-600 text-sm">Thank you for ordering with Warmpawz</p>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <div className="p-4 border-t border-gray-100 flex justify-center">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadDeliveryStatus}
          className="text-gray-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>
    </Card>
  );
}

export default DeliveryTrackingWidget;
