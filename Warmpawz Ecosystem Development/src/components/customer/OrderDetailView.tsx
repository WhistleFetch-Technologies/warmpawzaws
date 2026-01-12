import { useState } from 'react';
import { 
  ArrowLeft, 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle2,
  Phone,
  Mail,
  Truck,
  Download,
  RefreshCw,
  XCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface OrderDetailViewProps {
  order: any;
  onBack: () => void;
  onTrackOrder?: () => void;
  onReorder?: () => void;
  onContactSupport?: () => void;
}

export function OrderDetailView({ order, onBack, onTrackOrder, onReorder, onContactSupport }: OrderDetailViewProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      shipped: 'bg-purple-100 text-purple-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const orderTimeline = [
    { 
      status: 'Order Placed', 
      date: order.date, 
      time: '10:30 AM',
      icon: CheckCircle2,
      completed: true,
      description: 'Your order has been placed successfully'
    },
    { 
      status: 'Confirmed', 
      date: order.date,
      time: '11:45 AM',
      icon: CheckCircle2,
      completed: ['confirmed', 'shipped', 'delivered'].includes(order.status),
      description: 'Seller has confirmed your order'
    },
    { 
      status: 'Shipped', 
      date: order.status === 'shipped' || order.status === 'delivered' ? '2024-12-02' : '',
      time: order.status === 'shipped' || order.status === 'delivered' ? '09:00 AM' : '',
      icon: Truck,
      completed: ['shipped', 'delivered'].includes(order.status),
      description: 'Your order has been shipped'
    },
    { 
      status: 'Delivered', 
      date: order.status === 'delivered' ? order.estimatedDelivery : '',
      time: order.status === 'delivered' ? '02:30 PM' : '',
      icon: Package,
      completed: order.status === 'delivered',
      description: 'Order delivered successfully'
    }
  ];

  const deliveryFee = 60;
  const discount = 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Order Details</h1>
            <p className="text-sm text-gray-500">{order.orderNumber}</p>
          </div>
          <Badge className={getStatusColor(order.status)}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="pb-24">
        {/* Order Timeline */}
        {order.status !== 'cancelled' && (
          <div className="bg-white p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-4">Order Timeline</h2>
            <div className="relative">
              {orderTimeline.map((item, index) => (
                <div key={index} className="flex gap-4 pb-8 last:pb-0">
                  {/* Timeline Line */}
                  {index < orderTimeline.length - 1 && (
                    <div className={`absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-32px)] ${item.completed ? 'bg-green-500' : 'bg-gray-200'}`} 
                         style={{ top: `${32 + index * 80}px`, height: '48px' }} />
                  )}
                  
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.completed ? 'bg-green-500' : 'bg-gray-200'
                  }`}>
                    <item.icon className={`w-4 h-4 ${item.completed ? 'text-white' : 'text-gray-400'}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <p className={`font-medium ${item.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                      {item.status}
                    </p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                    {item.date && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {item.time}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Track Order Button */}
            {['confirmed', 'shipped'].includes(order.status) && onTrackOrder && (
              <Button
                onClick={onTrackOrder}
                className="w-full mt-4 bg-[#FF8C42] hover:bg-[#FF7028] text-white"
              >
                <Truck className="w-4 h-4 mr-2" />
                Track Order
              </Button>
            )}
          </div>
        )}

        {/* Cancelled Status */}
        {order.status === 'cancelled' && (
          <div className="bg-white p-6 mb-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900 mb-1">Order Cancelled</p>
                <p className="text-sm text-red-700">
                  This order was cancelled on {new Date(order.date).toLocaleDateString('en-IN')}
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Refund will be processed within 5-7 business days
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <div className="bg-white p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-gray-700" />
            <h2 className="font-semibold text-gray-900">Delivery Address</h2>
          </div>
          <div className="pl-7">
            <p className="text-gray-700 leading-relaxed">{order.deliveryAddress}</p>
            {order.estimatedDelivery && order.status !== 'delivered' && order.status !== 'cancelled' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>
                  Expected by {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Order Items ({order.items.length})</h2>
          <div className="space-y-4">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{item.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">Qty: {item.quantity}</p>
                  <p className="font-semibold text-gray-900">₹{item.price * item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Payment Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-gray-700">
              <span>Item Total</span>
              <span>₹{order.totalAmount - deliveryFee + discount}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Discount</span>
                <span>-₹{discount}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-gray-700">
              <span>Delivery Fee</span>
              {deliveryFee > 0 ? (
                <span>₹{deliveryFee}</span>
              ) : (
                <span className="text-green-600">FREE</span>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between text-lg font-bold text-gray-900">
              <span>Total Paid</span>
              <span>₹{order.totalAmount}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 pt-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Paid using UPI</span>
            </div>
          </div>
        </div>

        {/* Tracking Info */}
        {order.trackingNumber && ['shipped', 'delivered'].includes(order.status) && (
          <div className="bg-white p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Tracking Information</h2>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                <p className="font-mono font-medium text-gray-900">{order.trackingNumber}</p>
              </div>
              <button className="text-[#FF8C42] hover:text-[#FF7028]">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Help & Support */}
        <div className="bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Need Help?</h2>
          <div className="space-y-3">
            <button 
              onClick={onContactSupport}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Contact Support</p>
                  <p className="text-sm text-gray-500">Get help with your order</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Download className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Download Invoice</p>
                  <p className="text-sm text-gray-500">Get order invoice PDF</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      {order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex gap-3">
            {order.status === 'pending' && (
              <Button
                onClick={() => setShowCancelModal(true)}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
              >
                Cancel Order
              </Button>
            )}
            
            {order.status === 'delivered' && onReorder && (
              <Button
                onClick={onReorder}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7028] text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reorder
              </Button>
            )}

            {['confirmed', 'shipped'].includes(order.status) && onTrackOrder && (
              <Button
                onClick={onTrackOrder}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7028] text-white"
              >
                <Truck className="w-4 h-4 mr-2" />
                Track Order
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Order?</h2>
              <p className="text-gray-600">
                Are you sure you want to cancel this order? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowCancelModal(false)}
                variant="outline"
                className="flex-1"
              >
                Keep Order
              </Button>
              <Button
                onClick={() => {
                  setShowCancelModal(false);
                  // Handle cancellation
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
