"use client";

import { useState, useEffect, useRef } from 'react';
import { Bell, MapPin, Clock, Package, Phone, CheckCircle, XCircle, Loader2, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { playOrderAlertSound, alertNewOrder, vibrateDevice } from '@/lib/audio-alerts';

interface OrderBroadcast {
  id: string;
  order_id: string;
  pharmacy_id: string;
  radius_km: number;
  distance_from_customer: number;
  status: string;
  items: Array<{
    medicine_name: string;
    quantity: number;
    unit_price: number;
  }>;
  subtotal: number;
  deliveryAddress: {
    address: string;
    lat: number;
    lng: number;
    landmark?: string;
    pincode?: string;
  };
  payment_method: string;
  customer_name: string;
  notes?: string;
  broadcast_time: string;
}

interface PharmacyOrderAlertsProps {
  pharmacyId: string;
  pharmacyName?: string;
}

export function PharmacyOrderAlerts({ pharmacyId, pharmacyName }: PharmacyOrderAlertsProps) {
  const [broadcasts, setBroadcasts] = useState<OrderBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAcceptModal, setShowAcceptModal] = useState<OrderBroadcast | null>(null);
  const [quotedEta, setQuotedEta] = useState(30);
  const [useOwnLogistics, setUseOwnLogistics] = useState(false);
  // Audio handled by Web Audio API in audio-alerts.ts

  // Polling for new orders
  useEffect(() => {
    loadBroadcasts();
    const interval = setInterval(loadBroadcasts, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [pharmacyId]);

  // Play alert sound when new orders arrive
  useEffect(() => {
    if (broadcasts.length > 0 && soundEnabled) {
      playAlertSound();
    }
  }, [broadcasts.length]);

  const playAlertSound = () => {
    // Use Web Audio API for reliable sound
    playOrderAlertSound();
    // Also vibrate on mobile
    vibrateDevice([200, 100, 200, 100, 200]);
  };

  const loadBroadcasts = async () => {
    try {
      const response = await apiClient.get(`/pharmacy/broadcasts/pending/${pharmacyId}`) as any;
      if (response.success) {
        const newBroadcasts = response.broadcasts || [];
        // Check if there are new orders
        if (newBroadcasts.length > broadcasts.length && broadcasts.length > 0) {
          toast.info('🔔 New order received!', { duration: 5000 });
          // Trigger browser notification
          const newOrder = newBroadcasts[0];
          if (newOrder) {
            alertNewOrder(newOrder.order_id?.slice(0, 8) || 'NEW', 'Pharmacy');
          }
        }
        setBroadcasts(newBroadcasts);
      }
    } catch (error) {
      console.error('Error loading broadcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (broadcast: OrderBroadcast) => {
    setProcessing(broadcast.id);
    try {
      const response = await apiClient.post(`/pharmacy/broadcasts/${broadcast.id}/accept`, {
        quotedEtaMinutes: quotedEta,
        useOwnLogistics,
      }) as any;

      if (response.success) {
        toast.success('✅ Order accepted! Start preparing.');
        setShowAcceptModal(null);
        loadBroadcasts();
      } else {
        toast.error(response.error || 'Failed to accept order');
      }
    } catch (error: any) {
      if (error.message?.includes('ORDER_TAKEN')) {
        toast.error('This order was already accepted by another pharmacy');
      } else {
        toast.error('Failed to accept order');
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (broadcastId: string, reason: string = 'Not available') => {
    setProcessing(broadcastId);
    try {
      await apiClient.post(`/pharmacy/broadcasts/${broadcastId}/reject`, { reason });
      toast.info('Order rejected');
      loadBroadcasts();
    } catch (error) {
      toast.error('Failed to reject order');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Audio handled by Web Audio API - no file needed */}

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold">Order Alerts</h1>
              <p className="text-sm text-white/80">{broadcasts.length} pending orders</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Order List */}
      <div className="p-4 space-y-4">
        {broadcasts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">No Pending Orders</h3>
            <p className="text-gray-500 text-sm mt-1">
              New orders will appear here automatically
            </p>
          </div>
        ) : (
          broadcasts.map((broadcast) => (
            <div 
              key={broadcast.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border-l-4 border-green-500 animate-pulse-once"
            >
              {/* Order Header */}
              <div className="bg-green-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">New Order!</h3>
                    <p className="text-sm text-gray-600">{broadcast.customer_name || 'Customer'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    ₹{broadcast.subtotal}
                  </p>
                  <p className="text-xs text-gray-500">{formatTime(broadcast.broadcast_time)}</p>
                </div>
              </div>

              {/* Distance & Payment */}
              <div className="px-4 py-3 flex items-center gap-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">{broadcast.distance_from_customer} km</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    broadcast.payment_method === 'cod' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {broadcast.payment_method === 'cod' ? '💵 COD' : '💳 Online'}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 mb-2">Items ({broadcast.items?.length || 0})</p>
                <div className="space-y-1">
                  {broadcast.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.medicine_name}</span>
                      <span className="text-gray-500">x{item.quantity}</span>
                    </div>
                  ))}
                  {broadcast.items?.length > 3 && (
                    <p className="text-xs text-gray-400">+{broadcast.items.length - 3} more items</p>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-1">Deliver to</p>
                <p className="text-sm text-gray-700">
                  {broadcast.deliveryAddress?.address || 'Address not available'}
                </p>
                {broadcast.deliveryAddress?.landmark && (
                  <p className="text-xs text-gray-500">Near: {broadcast.deliveryAddress.landmark}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 flex gap-3">
                <button
                  onClick={() => handleReject(broadcast.id)}
                  disabled={processing === broadcast.id}
                  className="flex-1 py-3 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </button>
                <button
                  onClick={() => setShowAcceptModal(broadcast)}
                  disabled={processing === broadcast.id}
                  className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {processing === broadcast.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Accept
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Accept Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Accept Order</h3>
            
            {/* ETA Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Delivery Time
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setQuotedEta(mins)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      quotedEta === mins
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* Logistics Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Method
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setUseOwnLogistics(false)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                    !useOwnLogistics
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">Warmpawz Logistics</p>
                  <p className="text-xs text-gray-500">We'll handle delivery (fee deducted from settlement)</p>
                </button>
                <button
                  onClick={() => setUseOwnLogistics(true)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                    useOwnLogistics
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">Own Delivery</p>
                  <p className="text-xs text-gray-500">You'll deliver using your own staff</p>
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAcceptModal(null)}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(showAcceptModal)}
                disabled={processing === showAcceptModal.id}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === showAcceptModal.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Confirm & Accept'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-once {
          animation: pulse-once 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
