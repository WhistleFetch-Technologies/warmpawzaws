'use client';

import { X, Package, User, MapPin, CreditCard, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  product_image?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  payment_method: string;
  payment_status: string;
  shipping_address: any;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  items?: OrderItem[];
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusUpdate?: () => void;
}

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  onStatusUpdate
}: OrderDetailsModalProps) {
  const [fullOrder, setFullOrder] = useState<Order | null>(order);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      loadFullOrderDetails();
    }
  }, [isOpen, order]);

  const loadFullOrderDetails = async () => {
    if (!order) return;

    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/orders/${order.id}`);
      setFullOrder({
        ...order,
        ...response.order,
        items: response.order?.items || [],
      });
    } catch (err: any) {
      console.error('Error loading order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-purple-100 text-purple-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!isOpen || !fullOrder) return null;

  const address = typeof fullOrder.shipping_address === 'string'
    ? JSON.parse(fullOrder.shipping_address)
    : fullOrder.shipping_address;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Order #{fullOrder.order_number}
              </h3>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fullOrder.order_status)}`}>
                {fullOrder.order_status.charAt(0).toUpperCase() + fullOrder.order_status.slice(1)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading order details...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">Customer Information</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{fullOrder.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{fullOrder.customer_phone || 'N/A'}</p>
                </div>
                {fullOrder.customer_email && (
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{fullOrder.customer_email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            {address && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-900">Shipping Address</h4>
                </div>
                <div className="text-sm text-gray-700">
                  {address.street && <p>{address.street}</p>}
                  {address.city && address.state && (
                    <p>{address.city}, {address.state} {address.pincode || ''}</p>
                  )}
                  {address.landmark && <p className="text-gray-500">Landmark: {address.landmark}</p>}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
              <div className="space-y-3">
                {fullOrder.items && fullOrder.items.length > 0 ? (
                  fullOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        {item.product_image ? (
                          <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-2xl">🛍️</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₹{item.total.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">₹{item.price.toLocaleString()} each</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No items found</p>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">Payment Information</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Method</p>
                  <p className="font-medium text-gray-900 capitalize">{fullOrder.payment_method || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className={`font-medium ${fullOrder.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {fullOrder.payment_status || 'pending'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tracking Info */}
            {fullOrder.tracking_number && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Tracking Information</h4>
                </div>
                <div className="text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">Tracking Number:</span> {fullOrder.tracking_number}
                  </p>
                  {fullOrder.shipped_at && (
                    <p className="text-gray-600 mt-1">
                      Shipped on: {new Date(fullOrder.shipped_at).toLocaleString('en-IN')}
                    </p>
                  )}
                  {fullOrder.delivered_at && (
                    <p className="text-green-600 mt-1">
                      Delivered on: {new Date(fullOrder.delivered_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">₹{fullOrder.subtotal.toLocaleString()}</span>
              </div>
              {fullOrder.tax_amount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Tax (GST)</span>
                  <span className="font-medium text-gray-900">₹{fullOrder.tax_amount.toLocaleString()}</span>
                </div>
              )}
              {fullOrder.shipping_amount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-gray-900">₹{fullOrder.shipping_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-orange-600">₹{fullOrder.total_amount.toLocaleString()}</span>
              </div>
            </div>

            {/* Cancellation Info */}
            {fullOrder.cancelled_at && (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-700 mb-1">Order Cancelled</p>
                <p className="text-xs text-red-600">
                  {new Date(fullOrder.cancelled_at).toLocaleString('en-IN')}
                </p>
                {fullOrder.cancellation_reason && (
                  <p className="text-sm text-red-700 mt-2">
                    Reason: {fullOrder.cancellation_reason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            Close
          </button>
          {onStatusUpdate && getNextStatus(fullOrder.order_status).length > 0 && (
            <button
              onClick={() => {
                onClose();
                onStatusUpdate();
              }}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Update Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getNextStatus(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered', 'returned'],
    'delivered': ['returned'],
    'cancelled': [],
    'returned': ['refunded'],
    'refunded': [],
  };
  return transitions[currentStatus] || [];
}

