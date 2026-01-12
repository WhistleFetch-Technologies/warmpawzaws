import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, MapPin, Phone, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { authenticatedGet } from '../../utils/authenticatedFetch';
import { projectId } from '../../utils/supabase/info';

interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location: string;
  timestamp: string;
  isCompleted: boolean;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  sellerId: string;
  sellerName: string;
}

interface OrderTracking {
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  items: OrderItem[];
  deliveryAddress: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  trackingEvents: TrackingEvent[];
  currentLocation?: string;
  deliveredAt?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
}

export function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const statusSteps = [
    { key: 'pending', label: 'Order Placed', icon: Package },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle }
  ];

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    out_for_delivery: 'bg-orange-100 text-orange-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    if (orderId) {
      fetchTracking();
    }
  }, [orderId]);

  const fetchTracking = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/orders/${orderId}/tracking`,
        true
      );
      setTracking(data.tracking);
    } catch (error) {
      console.error('Error fetching tracking:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIndex = (status: string) => {
    return statusSteps.findIndex(step => step.key === status);
  };

  const copyTrackingNumber = () => {
    if (tracking?.trackingNumber) {
      navigator.clipboard.writeText(tracking.trackingNumber);
      alert('Tracking number copied!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 mb-4">Order tracking not found</p>
        <Button onClick={() => navigate('/shop/orders')}>Back to Orders</Button>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(tracking.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-800">Track Order</h1>
              <p className="text-sm text-gray-600">Order #{tracking.orderNumber}</p>
            </div>
            <button
              onClick={() => fetchTracking(true)}
              disabled={refreshing}
              className="text-[#FF8C42] hover:text-[#FF7A2F] text-sm font-semibold"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Current Status Banner */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Status</p>
              <h2 className="text-2xl font-bold text-gray-800">
                {statusSteps.find(s => s.key === tracking.status)?.label || tracking.status}
              </h2>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[tracking.status]}`}>
              {tracking.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {tracking.status === 'cancelled' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">Order Cancelled</p>
                <p className="text-sm text-red-700">
                  This order has been cancelled. Refund will be processed within 5-7 business days.
                </p>
              </div>
            </div>
          )}

          {tracking.estimatedDelivery && tracking.status !== 'delivered' && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-900 font-semibold">Estimated Delivery</p>
                <p className="text-sm text-blue-700">
                  {new Date(tracking.estimatedDelivery).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}

          {tracking.deliveredAt && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-900 font-semibold">Delivered on</p>
                <p className="text-sm text-green-700">
                  {new Date(tracking.deliveredAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Status Progress */}
        {tracking.status !== 'cancelled' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-6">Order Progress</h3>
            <div className="relative">
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;

                return (
                  <div key={step.key} className="relative">
                    {/* Connector Line */}
                    {index < statusSteps.length - 1 && (
                      <div
                        className={`absolute left-6 top-12 w-0.5 h-16 ${
                          index < currentStatusIndex ? 'bg-[#FF8C42]' : 'bg-gray-200'
                        }`}
                      />
                    )}

                    {/* Step */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                          isCompleted
                            ? 'bg-[#FF8C42] border-[#FF8C42]'
                            : 'bg-white border-gray-300'
                        } ${isCurrent ? 'ring-4 ring-orange-100' : ''}`}
                      >
                        <Icon
                          className={`w-6 h-6 ${isCompleted ? 'text-white' : 'text-gray-400'}`}
                        />
                      </div>
                      <div className="flex-1 pt-2">
                        <p
                          className={`font-semibold ${
                            isCompleted ? 'text-gray-800' : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </p>
                        {isCurrent && tracking.currentLocation && (
                          <p className="text-sm text-gray-600 mt-1">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            {tracking.currentLocation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tracking Information */}
        {tracking.trackingNumber && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Shipping Information</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tracking Number</span>
                <button
                  onClick={copyTrackingNumber}
                  className="text-sm font-semibold text-[#FF8C42] hover:text-[#FF7A2F]"
                >
                  {tracking.trackingNumber}
                </button>
              </div>
              {tracking.carrier && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Carrier</span>
                  <span className="text-sm font-semibold text-gray-800">{tracking.carrier}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Person Info */}
        {tracking.deliveryPersonName && tracking.status === 'out_for_delivery' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Delivery Person</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{tracking.deliveryPersonName}</p>
                <p className="text-sm text-gray-600">{tracking.deliveryPersonPhone}</p>
              </div>
              {tracking.deliveryPersonPhone && (
                <a
                  href={`tel:${tracking.deliveryPersonPhone}`}
                  className="w-12 h-12 bg-[#FF8C42] text-white rounded-full flex items-center justify-center hover:bg-[#FF7A2F]"
                >
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Tracking Timeline */}
        {tracking.trackingEvents && tracking.trackingEvents.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Tracking History</h3>
            <div className="space-y-4">
              {tracking.trackingEvents.map((event, index) => (
                <div key={event.id} className="relative">
                  {index < tracking.trackingEvents.length - 1 && (
                    <div className="absolute left-2 top-8 w-0.5 h-full bg-gray-200" />
                  )}
                  <div className="flex gap-4">
                    <div
                      className={`w-4 h-4 rounded-full mt-1 z-10 ${
                        event.isCompleted ? 'bg-[#FF8C42]' : 'bg-gray-300'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{event.status}</p>
                      <p className="text-sm text-gray-600">{event.description}</p>
                      {event.location && (
                        <p className="text-sm text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {event.location}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Delivery Address</h3>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-800">{tracking.deliveryAddress.name}</p>
              <p className="text-sm text-gray-600">{tracking.deliveryAddress.phone}</p>
              <p className="text-sm text-gray-600 mt-2">
                {tracking.deliveryAddress.addressLine1}
                {tracking.deliveryAddress.addressLine2 && `, ${tracking.deliveryAddress.addressLine2}`}
              </p>
              <p className="text-sm text-gray-600">
                {tracking.deliveryAddress.city}, {tracking.deliveryAddress.state} - {tracking.deliveryAddress.pincode}
              </p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Order Items</h3>
          <div className="space-y-3">
            {tracking.items.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/shop/product/${item.productId}`)}
                className="flex gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
              >
                <img
                  src={item.productImage}
                  alt={item.productName}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 mb-1 line-clamp-1">
                    {item.productName}
                  </h4>
                  <p className="text-xs text-gray-500 mb-1">Sold by {item.sellerName}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                    <span className="font-semibold text-gray-800">₹{item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
