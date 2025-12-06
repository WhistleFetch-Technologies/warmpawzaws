import { useState, useEffect } from 'react';
import { ArrowLeft, Package, ChevronRight, Search, Calendar, Truck, ShoppingBag, Filter, RotateCcw, Star } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner@2.0.3';
import { WriteReviewModal } from './WriteReviewModal';

interface OrderHistoryProps {
  customerPhone: string;
  onBack: () => void;
  onViewOrder: (orderId: string) => void;
}

export function OrderHistory({ customerPhone, onBack, onViewOrder }: OrderHistoryProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<any>(null); // Product/Item to review

  useEffect(() => {
    if (customerPhone) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [customerPhone]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/customer/${customerPhone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation(); // Prevent navigating to order detail
    setReorderingId(orderId);

    try {
      // Assuming we can derive customerId from phone or pass it. 
      // The backend endpoint expects 'customerId'. 
      // But wait, OrderHistory uses 'customerPhone'. 
      // We might need to resolve customerId or pass phone if backend supports it.
      // Let's fetch the customer ID first if we don't have it. 
      // Or, let's try passing the phone as customerId if the backend supports fallback, 
      // but `customer-ecommerce-endpoints.tsx` uses `kv.get('cart:' + customerId)`.
      // If customerPhone IS the identifier used for cart, then we are good.
      // In Warmpawz, phone is often used as ID. Let's assume phone is key.
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/${orderId}/reorder`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ customerId: customerPhone }) 
        }
      );

      const data = await res.json();

      if (res.ok) {
        toast.success("Items added to cart!");
        // Optionally redirect to cart
        // onBack(); // Or separate onGoToCart prop
      } else {
        if (data.details && Array.isArray(data.details)) {
           data.details.forEach((msg: string) => toast.warning(msg));
        } else {
           toast.error(data.error || "Failed to reorder");
        }
      }
    } catch (error) {
      console.error('Reorder error:', error);
      toast.error("Something went wrong");
    } finally {
      setReorderingId(null);
    }
  };

  const openReviewModal = (e: React.MouseEvent, item: any, orderId: string) => {
    e.stopPropagation();
    setReviewItem({ ...item, orderId }); // Pass orderId along with item
    setReviewModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
      case 'shipped': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'processing': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.items.some((item: any) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">My Orders</h1>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search orders..." 
              className="pl-9 bg-gray-50" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'pending', 'shipped', 'delivered', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                statusFilter === status 
                  ? "bg-indigo-600 text-white border-indigo-600" 
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900 mb-1">No orders found</p>
            <p className="text-sm">It looks like you haven't placed any orders yet.</p>
            <Button className="mt-4" onClick={onBack}>Start Shopping</Button>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Card 
              key={order.id} 
              className="bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onViewOrder(order.id)}
            >
              {/* Order Header */}
              <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Order {order.orderNumber}</p>
                  <p className="text-xs font-medium text-gray-900">
                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <Badge variant="secondary" className={cn("font-normal", getStatusColor(order.status))}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>

              {/* Order Body */}
              <div className="p-4">
                {/* Items Preview */}
                <div className="flex gap-3 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {order.items.map((item: any) => (
                    <div key={item.id} className="relative flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden border border-gray-100 group">
                      <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      {item.quantity > 1 && (
                        <span className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1 rounded-tl-md">
                          x{item.quantity}
                        </span>
                      )}
                      
                      {/* Review Button Overlay for Delivered Orders */}
                      {order.status === 'delivered' && (
                        <button 
                          className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => openReviewModal(e, item, order.id)}
                        >
                           <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 drop-shadow-md" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{order.items.length} items</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="font-semibold text-gray-900">₹{order.pricing.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-3 border-t flex justify-between items-center bg-gray-50/30">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-indigo-600 p-0 h-auto hover:bg-transparent hover:text-indigo-800"
                  onClick={(e) => { e.stopPropagation(); onViewOrder(order.id); }}
                >
                   View Details <ChevronRight className="w-4 h-4 ml-1" />
                </Button>

                {/* Reorder Button */}
                <Button 
                   variant="outline" 
                   size="sm"
                   className="gap-1.5 h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                   onClick={(e) => handleReorder(e, order.id)}
                   disabled={reorderingId === order.id}
                >
                   <RotateCcw className={cn("w-3 h-3", reorderingId === order.id && "animate-spin")} />
                   {reorderingId === order.id ? 'Adding...' : 'Reorder'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Review Modal */}
      {reviewItem && (
        <WriteReviewModal 
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          productId={reviewItem.productId}
          itemName={reviewItem.name}
          customerId={customerPhone}
          onSuccess={() => {
             // Optionally refresh orders or show success
             toast.success(`Reviewed ${reviewItem.name}`);
          }}
        />
      )}
    </div>
  );
}
