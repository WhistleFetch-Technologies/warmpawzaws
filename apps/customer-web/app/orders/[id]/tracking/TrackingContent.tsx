'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import Link from 'next/link';
import { Key, Eye, EyeOff, Copy, Check, Phone, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface TrackingInfo {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    trackingNumber?: string;
    shippedAt?: string;
    deliveredAt?: string;
    // Delivery OTP fields
    deliveryOtp?: string;
    otpVerified?: boolean;
    deliveryPartnerName?: string;
    deliveryPartnerPhone?: string;
  };
  shipments: Array<{
    id: string;
    awb_code: string;
    status: string;
    current_status: string;
    estimated_delivery_date?: string;
    tracking_url?: string;
    status_history?: Array<{
      status: string;
      timestamp: string;
      location?: string;
    }>;
  }>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TrackingContent() {
  const params = useParams();
  const orderId = params.id as string;

  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // OTP display states
  const [showOTP, setShowOTP] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);
  
  // Check if order is out for delivery
  const isOutForDelivery = (status: string) => {
    return ['out_for_delivery', 'shipped', 'dispatched', 'in_transit', 'arriving', 'on_way'].includes(status?.toLowerCase());
  };
  
  // Copy OTP to clipboard
  const copyOTP = () => {
    if (tracking?.order?.deliveryOtp) {
      navigator.clipboard.writeText(tracking.order.deliveryOtp);
      setCopiedOTP(true);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopiedOTP(false), 2000);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadTracking();
      // Refresh every 30 seconds
      const interval = setInterval(loadTracking, 30000);
      return () => clearInterval(interval);
    }
  }, [orderId]);

  const loadTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<any>(`/orders/${orderId}/tracking`);
      
      // Also fetch delivery OTP info if order is in transit
      let deliveryInfo: any = null;
      try {
        deliveryInfo = await apiClient.get<any>(`/delivery/${orderId}/status`);
      } catch (e) {
        // Delivery info might not exist for all orders
        console.log('Delivery status not available:', e);
      }
      
      // Merge delivery OTP info into tracking response
      if (response && response.order) {
        response.order.deliveryOtp = deliveryInfo?.delivery_otp || deliveryInfo?.deliveryOtp || deliveryInfo?.otp;
        response.order.otpVerified = deliveryInfo?.otp_verified || deliveryInfo?.otpVerified;
        response.order.deliveryPartnerName = deliveryInfo?.partner_name || deliveryInfo?.partnerName;
        response.order.deliveryPartnerPhone = deliveryInfo?.partner_phone || deliveryInfo?.partnerPhone;
      }
      
      setTracking(response);
    } catch (err: any) {
      console.error('Error loading tracking:', err);
      setError(err.message || 'Failed to load tracking information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { status: 'pending', label: 'Order Placed', icon: '📦' },
      { status: 'confirmed', label: 'Confirmed', icon: '✓' },
      { status: 'processing', label: 'Processing', icon: '⚙️' },
      { status: 'shipped', label: 'Shipped', icon: '🚚' },
      { status: 'delivered', label: 'Delivered', icon: '✅' },
    ];

    const currentIndex = steps.findIndex(s => s.status === currentStatus);
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 mb-4">{error || 'Tracking information not available'}</p>
            <Link
              href="/orders"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition inline-block"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps(tracking.order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Order Tracking</h1>
            <p className="text-gray-500 mt-1">Order #{tracking.order.orderNumber}</p>
          </div>
          <Link
            href="/orders"
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Back to Orders
          </Link>
        </div>

        {/* Tracking Number */}
        {tracking.order.trackingNumber && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Tracking Number</p>
                <p className="text-xl font-bold text-gray-900">{tracking.order.trackingNumber}</p>
              </div>
              {tracking.shipments[0]?.tracking_url && (
                <a
                  href={tracking.shipments[0].tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
                >
                  Track on Carrier Site
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivery OTP Section - Show when order is out for delivery */}
        {isOutForDelivery(tracking.order.status) && tracking.order.deliveryOtp && !tracking.order.otpVerified && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl shadow-sm p-6 mb-6 border-2 border-orange-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-6 h-6 text-orange-600" />
                <h2 className="text-lg font-bold text-orange-800">Your Delivery OTP</h2>
              </div>
              {tracking.order.deliveryPartnerName && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{tracking.order.deliveryPartnerName}</span>
                  </div>
                  {tracking.order.deliveryPartnerPhone && (
                    <button
                      onClick={() => window.location.href = `tel:${tracking.order.deliveryPartnerPhone}`}
                      className="p-2 bg-orange-100 rounded-full hover:bg-orange-200 transition"
                    >
                      <Phone className="w-4 h-4 text-orange-600" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* OTP Display */}
            <div className="flex justify-center gap-3 mb-4">
              {tracking.order.deliveryOtp.split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-14 h-16 bg-white rounded-xl shadow-sm border-2 border-orange-300 flex items-center justify-center"
                >
                  <span className="text-3xl font-bold text-orange-600">
                    {showOTP ? digit : '•'}
                  </span>
                </div>
              ))}
            </div>
            
            {/* OTP Actions */}
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => setShowOTP(!showOTP)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition font-medium"
              >
                {showOTP ? (
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
                onClick={copyOTP}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition font-medium"
              >
                {copiedOTP ? (
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
            <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-100/50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>Share this OTP with the delivery partner <strong>only after receiving your order</strong>. This confirms delivery and releases payment.</p>
            </div>
          </div>
        )}

        {/* OTP Verified Success Message */}
        {tracking.order.otpVerified && tracking.order.status === 'delivered' && (
          <div className="bg-green-50 rounded-xl shadow-sm p-6 mb-6 border border-green-200 flex items-center justify-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-green-800">Delivery Confirmed!</h3>
              <p className="text-sm text-green-600">Your order has been delivered and verified successfully.</p>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Status</h2>
          <div className="relative">
            {statusSteps.map((step, index) => (
              <div key={step.status} className="flex items-start gap-4 mb-6 last:mb-0">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                  step.completed 
                    ? step.current 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {step.icon}
                </div>
                <div className="flex-1 pt-2">
                  <p className={`font-medium ${
                    step.completed ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  {step.current && step.status === 'shipped' && tracking.order.shippedAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      Shipped on: {new Date(tracking.order.shippedAt).toLocaleString('en-IN')}
                    </p>
                  )}
                  {step.current && step.status === 'delivered' && tracking.order.deliveredAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      Delivered on: {new Date(tracking.order.deliveredAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`absolute left-6 w-0.5 h-12 ${
                    step.completed ? 'bg-green-500' : 'bg-gray-200'
                  }`} style={{ top: '48px', marginLeft: '-1px' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shipment Details */}
        {tracking.shipments && tracking.shipments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipment Details</h2>
            {tracking.shipments.map((shipment) => (
              <div key={shipment.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">AWB Code</p>
                    <p className="font-medium text-gray-900">{shipment.awb_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium text-gray-900 capitalize">{shipment.current_status || shipment.status}</p>
                  </div>
                  {shipment.estimated_delivery_date && (
                    <div>
                      <p className="text-sm text-gray-500">Estimated Delivery</p>
                      <p className="font-medium text-gray-900">
                        {new Date(shipment.estimated_delivery_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status History */}
                {shipment.status_history && shipment.status_history.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Status History</p>
                    <div className="space-y-2">
                      {shipment.status_history.map((history, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 capitalize">{history.status}</p>
                            {history.location && (
                              <p className="text-sm text-gray-500">{history.location}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(history.timestamp).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <Link
            href={`/orders/${orderId}`}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition text-center"
          >
            View Order Details
          </Link>
          <Link
            href="/orders"
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition text-center"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
