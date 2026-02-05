"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Navigation, Package, MapPin, Phone, Clock, CheckCircle, 
  ArrowRight, Camera, IndianRupee, TrendingUp, Loader2,
  ChevronRight, AlertCircle, Play, Pause, Volume2
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ActiveOrder {
  trackingId: string;
  orderType: 'pharmacy' | 'meal';
  orderNumber: string;
  totalAmount: number;
  deliveryAddress: any;
  paymentMethod: string;
  status: string;
  deliveryOtp: string;
  assignedAt: string;
}

interface AvailableOrder {
  orderId: string;
  orderNumber: string;
  orderType: string;
  vendorName: string;
  totalAmount: number;
  deliveryFee: number;
  deliveryAddress: any;
  paymentMethod: string;
}

interface DeliveryPartnerDashboardProps {
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  vehicleNumber?: string;
}

export function DeliveryPartnerDashboard({ 
  partnerId, 
  partnerName, 
  partnerPhone,
  vehicleNumber 
}: DeliveryPartnerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'earnings'>('active');
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [earnings, setEarnings] = useState({ totalDeliveries: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadData();
    startLocationTracking();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(loadData, 10000);
    
    return () => {
      clearInterval(interval);
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [partnerId]);

  const startLocationTracking = () => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  };

  const loadData = async () => {
    try {
      const [ordersRes, availableRes, earningsRes] = await Promise.all([
        apiClient.get(`/delivery/partner/${partnerId}/orders?status=active`) as Promise<any>,
        apiClient.get(`/delivery/available/${partnerId}?lat=${currentLocation?.lat || 0}&lng=${currentLocation?.lng || 0}`) as Promise<any>,
        apiClient.get(`/delivery/partner/${partnerId}/earnings?period=today`) as Promise<any>,
      ]);

      if (ordersRes.success) setActiveOrders(ordersRes.orders || []);
      if (availableRes.success) setAvailableOrders(availableRes.availableOrders || []);
      if (earningsRes.success) setEarnings(earningsRes.earnings || { totalDeliveries: 0, totalEarnings: 0 });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (order: AvailableOrder) => {
    setAccepting(order.orderId);
    try {
      const response = await apiClient.post(`/delivery/accept/${order.orderId}`, {
        orderType: order.orderType,
        partnerId,
        partnerName,
        partnerPhone,
        vehicleNumber,
      }) as any;

      if (response.success) {
        toast.success('🚀 Order accepted! Head to pickup.');
        loadData();
        setActiveTab('active');
      }
    } catch (error: any) {
      if (error.message?.includes('ALREADY_ASSIGNED')) {
        toast.error('Order was already taken by another partner');
      } else {
        toast.error('Failed to accept order');
      }
    } finally {
      setAccepting(null);
    }
  };

  const handleUpdateStatus = async (trackingId: string, newStatus: string) => {
    try {
      await apiClient.post(`/delivery/${trackingId}/update-status`, { status: newStatus });
      
      // Update location on status change
      if (currentLocation) {
        await apiClient.post(`/delivery/${trackingId}/update-location`, {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        });
      }

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleVerifyOtp = async () => {
    if (!selectedOrder || otpInput.length !== 4) return;

    setVerifying(true);
    try {
      const response = await apiClient.post(`/delivery/${selectedOrder.trackingId}/verify-otp`, {
        otp: otpInput,
      }) as any;

      if (response.success) {
        toast.success('✅ Delivery completed!');
        setSelectedOrder(null);
        setOtpInput('');
        loadData();
      }
    } catch (error: any) {
      if (error.message?.includes('INVALID_OTP')) {
        toast.error('Invalid OTP. Please check and try again.');
      } else {
        toast.error('Failed to verify OTP');
      }
    } finally {
      setVerifying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'heading_to_pickup': return 'bg-blue-500';
      case 'at_pickup': return 'bg-purple-500';
      case 'picked_up': return 'bg-orange-500';
      case 'on_the_way': return 'bg-amber-500';
      case 'nearby': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getNextAction = (status: string): { label: string; nextStatus: string } | null => {
    switch (status) {
      case 'heading_to_pickup': return { label: 'Arrived at Pickup', nextStatus: 'at_pickup' };
      case 'at_pickup': return { label: 'Picked Up', nextStatus: 'picked_up' };
      case 'picked_up': return { label: 'On The Way', nextStatus: 'on_the_way' };
      case 'on_the_way': return { label: 'Nearby', nextStatus: 'nearby' };
      case 'nearby': return null; // Show OTP verification instead
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-bold text-lg">Delivery Dashboard</h1>
            <p className="text-sm text-white/80">{partnerName}</p>
          </div>
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 ${
              isOnline ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            {isOnline ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <p className="text-xs text-white/80">Today's Deliveries</p>
            <p className="text-2xl font-bold">{earnings.totalDeliveries}</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <p className="text-xs text-white/80">Today's Earnings</p>
            <p className="text-2xl font-bold">₹{earnings.totalEarnings}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        {[
          { id: 'active', label: 'Active', count: activeOrders.length },
          { id: 'available', label: 'Available', count: availableOrders.length },
          { id: 'earnings', label: 'Earnings', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-orange-600 border-orange-500'
                : 'text-gray-500 border-transparent'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Active Orders */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700">No Active Orders</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Accept available orders to start delivering
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-xl font-medium"
                >
                  View Available Orders
                </button>
              </div>
            ) : (
              activeOrders.map((order) => (
                <div key={order.trackingId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 border-b flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(order.status)}`} />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mt-1">#{order.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">₹{order.totalAmount}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        order.paymentMethod === 'cod' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {order.paymentMethod === 'cod' ? 'Collect Cash' : 'Paid Online'}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {order.deliveryAddress?.address || 'Address'}
                        </p>
                        {order.deliveryAddress?.landmark && (
                          <p className="text-xs text-gray-500">Near: {order.deliveryAddress.landmark}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-gray-50 space-y-2">
                    {order.status === 'nearby' ? (
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Complete Delivery (Enter OTP)
                      </button>
                    ) : (
                      getNextAction(order.status) && (
                        <button
                          onClick={() => handleUpdateStatus(order.trackingId, getNextAction(order.status)!.nextStatus)}
                          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                          <ArrowRight className="w-5 h-5" />
                          {getNextAction(order.status)!.label}
                        </button>
                      )
                    )}
                    
                    {/* Navigate Button */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryAddress?.lat},${order.deliveryAddress?.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 border border-gray-300 rounded-xl font-medium flex items-center justify-center gap-2 text-gray-700"
                    >
                      <Navigation className="w-5 h-5" />
                      Navigate
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Available Orders */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            {availableOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700">No Orders Available</h3>
                <p className="text-gray-500 text-sm mt-1">
                  New orders will appear here when available
                </p>
              </div>
            ) : (
              availableOrders.map((order) => (
                <div key={order.orderId} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.orderType === 'pharmacy' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {order.orderType === 'pharmacy' ? '💊 Pharmacy' : '🍱 Meal'}
                      </span>
                      <p className="font-semibold text-gray-900 mt-1">{order.vendorName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Earn</p>
                      <p className="text-lg font-bold text-green-600">₹{order.deliveryFee}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
                    <p className="text-sm text-gray-600">{order.deliveryAddress?.address}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      order.paymentMethod === 'cod' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {order.paymentMethod === 'cod' ? 'Collect ₹' + order.totalAmount : 'Prepaid'}
                    </span>
                    <button
                      onClick={() => handleAcceptOrder(order)}
                      disabled={accepting === order.orderId}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {accepting === order.orderId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Accept <ChevronRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Earnings */}
        {activeTab === 'earnings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <IndianRupee className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-3xl font-bold text-gray-900">₹{earnings.totalEarnings}</p>
              <p className="text-sm text-gray-500">Today's Earnings</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Delivery Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Deliveries</span>
                  <span className="font-semibold">{earnings.totalDeliveries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg per Delivery</span>
                  <span className="font-semibold">
                    ₹{earnings.totalDeliveries > 0 
                      ? Math.round(earnings.totalEarnings / earnings.totalDeliveries) 
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OTP Verification Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Enter Delivery OTP</h3>
            <p className="text-sm text-gray-500 mb-6">
              Ask the customer for the 4-digit OTP to complete delivery
            </p>

            <input
              type="text"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit OTP"
              className="w-full p-4 text-center text-2xl font-mono border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 mb-4"
              maxLength={4}
              inputMode="numeric"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setOtpInput('');
                }}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={otpInput.length !== 4 || verifying}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
