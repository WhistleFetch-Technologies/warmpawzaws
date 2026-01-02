import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Package, Truck, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import { useRealtimeUpdates } from '../../../hooks/useRealtimeUpdates';

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
}

export function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Real-time Updates
  // Subscribe to the specific order topic
  useRealtimeUpdates({
    topic: `order:${orderId}`,
    onUpdate: (update) => {
      if (update.type === 'order_update') {
        console.log('📦 Order updated:', update);
        // Refresh order data locally or fetch again
        // Since update payload might not have full order data, let's merge or refetch.
        // For now, let's refetch to be safe and get full object.
        fetchOrderDetails(); 
        toast.info(`Order status updated: ${update.status}`);
      }
    }
  });

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/${orderId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      } else {
        // toast.error("Failed to load order details");
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error("Error loading order");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    setCancelling(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/${orderId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'Customer cancelled via app' })
        }
      );

      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        toast.success("Order cancelled successfully");
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to cancel order");
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error("Error cancelling order");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) return null;

  const canCancel = !['delivered', 'cancelled', 'shipped'].includes(order.status.toLowerCase());
  
  // Tracking Timeline
  const steps = [
    { id: 'pending', label: 'Order Placed', icon: Package },
    { id: 'processing', label: 'Processing', icon: Clock },
    { id: 'shipped', label: 'Shipped', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const getCurrentStepIndex = () => {
    if (order.status === 'cancelled') return -1;
    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    return statusOrder.indexOf(order.status.toLowerCase());
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-lg">Order Details</h1>
          <p className="text-xs text-gray-500">ID: {order.orderNumber}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card className="p-5 bg-white">
          {order.status === 'cancelled' ? (
             <div className="flex items-center gap-3 text-red-600 mb-4">
               <XCircle className="w-6 h-6" />
               <div>
                 <h3 className="font-semibold">Order Cancelled</h3>
                 <p className="text-xs text-gray-500">Reason: {order.cancellationReason || 'Customer request'}</p>
               </div>
             </div>
          ) : (
            <div className="mb-6">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-semibold text-gray-900">Order Status</h3>
                 <Badge variant="outline" className="capitalize">
                   {order.status}
                 </Badge>
               </div>
               
               {/* Timeline */}
               <div className="relative pl-4 border-l-2 border-gray-100 space-y-6">
                 {steps.map((step, index) => {
                   const isCompleted = index <= currentStepIndex;
                   const isCurrent = index === currentStepIndex;
                   
                   return (
                     <div key={step.id} className="relative">
                       <div className={cn(
                         "absolute -left-[21px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-colors",
                         isCompleted ? "border-indigo-600 text-indigo-600" : "border-gray-200 text-gray-300",
                         isCurrent && "bg-indigo-50"
                       )}>
                         <step.icon className="w-4 h-4" />
                       </div>
                       <div className="ml-4">
                         <p className={cn("text-sm font-medium", isCompleted ? "text-gray-900" : "text-gray-400")}>
                           {step.label}
                         </p>
                         {isCurrent && (
                           <p className="text-xs text-indigo-600 mt-0.5">
                             {order.tracking?.message || 'In Progress'}
                           </p>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
        </Card>

        {/* Shipping Address */}
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 mb-3 text-gray-900">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-sm">Delivery Address</h3>
          </div>
          <div className="text-sm text-gray-600 ml-6">
            <p className="font-medium text-gray-900">{order.address.fullName}</p>
            <p>{order.address.street}</p>
            <p>{order.address.city}, {order.address.zipCode}</p>
            <p className="mt-1">Phone: {order.address.phone}</p>
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-4 bg-white">
           <h3 className="font-semibold text-sm text-gray-900 mb-3">Order Items ({order.items.length})</h3>
           <div className="space-y-4">
             {order.items.map((item: any) => (
               <div key={item.id} className="flex gap-3">
                 <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 border border-gray-100">
                   <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                 </div>
                 <div className="flex-1">
                   <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                   <div className="flex justify-between items-end mt-1">
                     <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                     <p className="text-sm font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </Card>

        {/* Payment Summary */}
        <Card className="p-4 bg-white space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 mb-2">Payment Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Payment Method</span>
              <span className="uppercase">{order.paymentMethod}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{order.pricing.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax & Fees</span>
              <span>₹{order.pricing.gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span className={order.pricing.shipping === 0 ? "text-green-600" : ""}>
                {order.pricing.shipping === 0 ? "Free" : `₹${order.pricing.shipping}`}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>Total Amount</span>
              <span>₹{order.pricing.total.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Cancel Button */}
        {canCancel && (
          <Button 
            variant="outline" 
            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleCancelOrder}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        )}
      </div>
    </div>
  );
}
