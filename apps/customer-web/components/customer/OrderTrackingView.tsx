"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface OrderTrackingViewProps {
  orderId: string;
  onBack: () => void;
}

interface TrackingStatus {
  status: string;
  timestamp: string;
  location?: string;
  description: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  order_status?: string;
  items: any[];
  shipping_address: any;
  tracking_number?: string;
  estimated_delivery?: string;
  tracking_history?: TrackingStatus[];
  created_at: string;
  cancellation_reason?: string;
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export function OrderTrackingView({ orderId, onBack }: OrderTrackingViewProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // PHASE 1.3 FIX: Use correct endpoint /customer/orders/:id instead of /ecommerce/orders/:id
      const response = await apiClient.get<any>(`/customer/orders/${orderId}`);
      const raw = response.order || response;
      setOrder({
        ...raw,
        status: raw.status || raw.order_status || 'pending',
      });
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError(err.message || 'Failed to load order details');
      toast.error('Failed to load order tracking information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status: string) => {
    return statusSteps.findIndex(step => step.key === status);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
      processing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      shipped: 'bg-purple-100 text-purple-700 border-purple-200',
      out_for_delivery: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      delivered: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Track Order</h1>
          </div>
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Track Order</h1>
          </div>
          <Card className="p-6 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Order ID: {orderId}</p>
            <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
            <Button onClick={loadOrderDetails} variant="outline">Retry</Button>
          </Card>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Track Order</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Info */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500">Order Number</p>
                <p className="font-semibold text-gray-900">{order.order_number || order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <Badge className={getStatusColor(order.status)}>
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
            {order.tracking_number && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">Tracking Number</p>
                <p className="font-mono text-sm font-semibold">{order.tracking_number}</p>
              </div>
            )}
          </Card>

          {order.status === 'cancelled' && order.cancellation_reason && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-sm font-semibold text-red-800">Order cancelled</p>
              <p className="text-sm text-red-700 mt-1">{order.cancellation_reason}</p>
            </Card>
          )}

          {/* Tracking Timeline */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Tracking Timeline</h3>
            <div className="space-y-4">
              {statusSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-[#FF8C42] text-white' 
                          : 'bg-gray-200 text-gray-400'
                      }`}>
                        <StepIcon className="w-5 h-5" />
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div className={`w-0.5 h-12 ${
                          isCompleted ? 'bg-[#FF8C42]' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className={`font-medium ${
                        isCurrent ? 'text-[#FF8C42]' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      {isCurrent && order.estimated_delivery && (
                        <p className="text-sm text-gray-500 mt-1">
                          Estimated delivery: {new Date(order.estimated_delivery).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Shipping Address */}
          {order.shipping_address && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                Delivery Address
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.shipping_address.name}</p>
                <p>{order.shipping_address.line1}</p>
                {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}</p>
                {order.shipping_address.phone && (
                  <p className="flex items-center gap-2 mt-2">
                    <Phone className="w-4 h-4" />
                    {order.shipping_address.phone}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
              <div className="space-y-3">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      {item.product_emoji || '📦'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product_name || item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity} × ₹{item.price?.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

