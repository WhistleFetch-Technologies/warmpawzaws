import React, { useState, useEffect } from 'react';
import { MapPin, Package, Clock, CheckCircle, Phone, Navigation } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * 📍 FOOD DELIVERY TRACKING COMPONENT
 * 
 * Phase 7B: Critical Services - Rule 8 Implementation
 * 
 * Features:
 * - Live GPS tracking
 * - Delivery ETA
 * - Driver contact
 * - Order status updates
 */

interface DeliveryOrder {
  orderId: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  estimatedDeliveryTime: string;
  trackingData?: {
    currentLat: number;
    currentLng: number;
    lastUpdated: string;
  };
  deliveryAddress: {
    address: string;
    lat: number;
    lng: number;
  };
  items: Array<{
    itemName: string;
    quantity: number;
    price: number;
  }>;
  grandTotal: number;
}

interface FoodDeliveryTrackingProps {
  orderId: string;
}

export default function FoodDeliveryTracking({ orderId }: FoodDeliveryTrackingProps) {
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderTracking();
    const interval = setInterval(fetchOrderTracking, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderTracking = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/food-delivery/track/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setOrder(data.data.order);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error tracking order:', error);
      setLoading(false);
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { status: 'pending', label: 'Order Placed', icon: Package },
      { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
      { status: 'preparing', label: 'Preparing', icon: Clock },
      { status: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation },
      { status: 'delivered', label: 'Delivered', icon: CheckCircle },
    ];

    const currentIndex = steps.findIndex((s) => s.status === order?.status);

    return steps.map((step, index) => ({
      ...step,
      isComplete: index <= currentIndex,
      isCurrent: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg p-12 text-center max-w-md">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600">Unable to find order details</p>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <h1 className="text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-gray-600">Order ID: {orderId}</p>
        </div>

        {/* Status Timeline */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-gray-900 mb-6">Order Status</h2>
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-200"></div>
            <div
              className="absolute left-6 top-6 w-0.5 bg-orange-500 transition-all duration-500"
              style={{
                height: `${(statusSteps.findIndex((s) => s.isCurrent) / (statusSteps.length - 1)) * 100}%`,
              }}
            ></div>

            {/* Steps */}
            <div className="space-y-8 relative">
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${
                        step.isComplete ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`${step.isComplete ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</h3>
                      {step.isCurrent && (
                        <p className="text-orange-500 text-sm">In Progress</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        {order.status === 'out_for_delivery' && (
          <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Navigation className="w-6 h-6 text-orange-500" />
              <h2 className="text-gray-900">Your order is on the way!</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Estimated Delivery Time</p>
                <p className="text-gray-900">{new Date(order.estimatedDeliveryTime).toLocaleTimeString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">Delivery Address</p>
                <p className="text-gray-900">{order.deliveryAddress.address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Location Map Placeholder */}
        {order.trackingData && order.status === 'out_for_delivery' && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-gray-900 mb-4">Live Location</h2>
            <div className="bg-gray-200 rounded-lg h-64 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Map integration would display here</p>
                <p className="text-gray-500 text-sm mt-2">
                  Current Location: {order.trackingData.currentLat.toFixed(4)}, {order.trackingData.currentLng.toFixed(4)}
                </p>
                <p className="text-gray-500 text-sm">
                  Last Updated: {new Date(order.trackingData.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between text-gray-600">
                <span>
                  {item.itemName} x {item.quantity}
                </span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between text-gray-900">
              <span>Total</span>
              <span>₹{order.grandTotal}</span>
            </div>
          </div>
        </div>

        {/* Delivered Status */}
        {order.status === 'delivered' && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-gray-900 mb-2">Order Delivered!</h2>
            <p className="text-gray-600">Thank you for your order. We hope your pet enjoys the meal!</p>
          </div>
        )}
      </div>
    </div>
  );
}
