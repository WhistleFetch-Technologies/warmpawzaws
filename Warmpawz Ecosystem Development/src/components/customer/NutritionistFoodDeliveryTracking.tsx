import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import {
  MapPin,
  Phone,
  Clock,
  Package,
  CheckCircle,
  Truck,
  Home,
  User,
  Star,
  Navigation,
  X,
  RefreshCw,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface DeliveryPartner {
  partnerId: string;
  name: string;
  phone: string;
  vehicleType: string;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  rating?: number;
  completedDeliveries?: number;
}

interface Order {
  orderId: string;
  status: 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  deliveryPartner?: DeliveryPartner;
  deliveryAddress: {
    street: string;
    city: string;
    zip: string;
    location: { lat: number; lng: number };
  };
  items: Array<{
    itemId: string;
    name?: string;
    quantity: number;
  }>;
  totalAmount: number;
  createdAt: string;
}

interface TrackingData {
  order: Order;
  tracking: {
    orderId: string;
    partnerId: string;
    currentLocation: {
      lat: number;
      lng: number;
      timestamp: string;
    };
    startLocation: { lat: number; lng: number };
    destinationLocation: { lat: number; lng: number };
    status: string;
    waypoints: Array<{ lat: number; lng: number; timestamp: string }>;
  };
  eta: string;
  distance: string | null;
  lastUpdated: string;
}

interface NutritionistFoodDeliveryTrackingProps {
  orderId: string;
  onClose: () => void;
}

export function NutritionistFoodDeliveryTracking({
  orderId,
  onClose
}: NutritionistFoodDeliveryTrackingProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch tracking data
  const fetchTrackingData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/nutritionist/delivery/${orderId}/gps`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tracking data');
      }

      const result = await response.json();
      setTrackingData(result.data);
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      setError('Unable to load tracking information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    // Auto-refresh every 10 seconds
    intervalRef.current = setInterval(() => {
      fetchTrackingData(false);
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrackingData(false);
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      'placed': Package,
      'confirmed': CheckCircle,
      'preparing': Clock,
      'out_for_delivery': Truck,
      'delivered': CheckCircle,
      'cancelled': X
    };
    return icons[status] || Package;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'placed': 'bg-gray-100 text-gray-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'preparing': 'bg-yellow-100 text-yellow-700',
      'out_for_delivery': 'bg-orange-100 text-orange-700',
      'delivered': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'placed': 'Order Placed',
      'confirmed': 'Order Confirmed',
      'preparing': 'Preparing Food',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return texts[status] || status;
  };

  if (loading && !trackingData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-700">Loading tracking information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900">Error Loading Tracking</h3>
            <p className="text-gray-600 text-center">{error}</p>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => fetchTrackingData()} variant="outline">
                Try Again
              </Button>
              <Button onClick={onClose} className="bg-gradient-to-r from-orange-500 to-pink-500">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trackingData) return null;

  const StatusIcon = getStatusIcon(trackingData.order.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Track Your Order</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <StatusIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Order #{trackingData.order.orderId}</p>
              <p className="font-semibold text-lg">{getStatusText(trackingData.order.status)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ETA Card */}
          {trackingData.order.status === 'out_for_delivery' && (
            <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-4 border-2 border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estimated Arrival</p>
                    <p className="text-2xl font-bold text-orange-600">{trackingData.eta}</p>
                  </div>
                </div>
                {trackingData.distance && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Distance</p>
                    <p className="font-semibold text-gray-900">{trackingData.distance}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Partner Info */}
          {trackingData.order.deliveryPartner && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                Delivery Partner
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {trackingData.order.deliveryPartner.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{trackingData.order.deliveryPartner.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {trackingData.order.deliveryPartner.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm text-gray-600">{trackingData.order.deliveryPartner.rating}</span>
                        </div>
                      )}
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-600 capitalize">
                        {trackingData.order.deliveryPartner.vehicleType}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`tel:${trackingData.order.deliveryPartner.phone}`}
                    className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
                  >
                    <Phone className="w-5 h-5 text-green-600" />
                  </a>
                  <button className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Map Placeholder (can be replaced with actual Google Maps) */}
          {trackingData.tracking && trackingData.order.status === 'out_for_delivery' && (
            <div className="bg-gray-100 rounded-xl border-2 border-gray-200 overflow-hidden">
              <div className="aspect-video relative bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-orange-500 mx-auto mb-2 animate-bounce" />
                  <p className="text-gray-700 font-medium">Live Tracking</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Lat: {trackingData.tracking.currentLocation.lat.toFixed(4)}, 
                    Lng: {trackingData.tracking.currentLocation.lng.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated: {new Date(trackingData.tracking.currentLocation.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Home className="w-5 h-5 text-orange-500" />
              Delivery Address
            </h3>
            <p className="text-gray-700">{trackingData.order.deliveryAddress.street}</p>
            <p className="text-gray-600 text-sm mt-1">
              {trackingData.order.deliveryAddress.city}, {trackingData.order.deliveryAddress.zip}
            </p>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Order Items
            </h3>
            <div className="space-y-2">
              {trackingData.order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name || `Item ${idx + 1}`} x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-orange-600">
                ₹{trackingData.order.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Order Timeline</h3>
            <div className="space-y-4">
              {[
                { status: 'placed', label: 'Order Placed', time: new Date(trackingData.order.createdAt).toLocaleTimeString() },
                { status: 'confirmed', label: 'Order Confirmed', time: null },
                { status: 'preparing', label: 'Preparing Food', time: null },
                { status: 'out_for_delivery', label: 'Out for Delivery', time: null },
                { status: 'delivered', label: 'Delivered', time: null }
              ].map((step, idx) => {
                const isActive = trackingData.order.status === step.status;
                const isCompleted = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']
                  .indexOf(trackingData.order.status) >= idx;
                
                return (
                  <div key={step.status} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <div className="w-2 h-2 bg-gray-400 rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isActive ? 'text-orange-600' : 'text-gray-900'}`}>
                        {step.label}
                      </p>
                      {step.time && (
                        <p className="text-sm text-gray-500">{step.time}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Contact our support team if you have any issues with your order.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Phone className="w-4 h-4 mr-2" />
                Call Support
              </Button>
              <Button variant="outline" className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
