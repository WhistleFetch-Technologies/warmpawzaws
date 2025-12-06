import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  Search,
  Filter,
  ChevronRight,
  Truck,
  Box,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  totalAmount: number;
  deliveryAddress: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
}

interface OrderHistoryViewProps {
  phone: string;
  onBack: () => void;
  onOrderClick: (order: Order) => void;
}

export function OrderHistoryView({ phone, onBack, onOrderClick }: OrderHistoryViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Mock orders data
  const mockOrders: Order[] = [
    {
      id: 'ord-001',
      orderNumber: 'WP2024001234',
      date: '2024-11-28',
      status: 'delivered',
      items: [
        { id: 'p1', name: 'Royal Canin Adult Dog Food 10kg', quantity: 1, price: 2499, image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=200' },
        { id: 'p2', name: 'Kong Classic Dog Toy', quantity: 2, price: 899, image: 'https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=200' }
      ],
      totalAmount: 4297,
      deliveryAddress: '123, MG Road, Bangalore',
      estimatedDelivery: '2024-11-30',
      trackingNumber: 'TRK1234567890'
    },
    {
      id: 'ord-002',
      orderNumber: 'WP2024001235',
      date: '2024-11-30',
      status: 'shipped',
      items: [
        { id: 'p3', name: 'NexGard Spectra (Medium Dogs)', quantity: 1, price: 1200, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200' }
      ],
      totalAmount: 1200,
      deliveryAddress: '123, MG Road, Bangalore',
      estimatedDelivery: '2024-12-05',
      trackingNumber: 'TRK1234567891'
    },
    {
      id: 'ord-003',
      orderNumber: 'WP2024001236',
      date: '2024-12-01',
      status: 'confirmed',
      items: [
        { id: 'p4', name: 'Orthopedic Pet Bed (Large)', quantity: 1, price: 3499, image: 'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=200' },
        { id: 'p5', name: 'Stainless Steel Pet Bowl Set', quantity: 1, price: 599, image: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=200' }
      ],
      totalAmount: 4098,
      deliveryAddress: '123, MG Road, Bangalore',
      estimatedDelivery: '2024-12-06'
    },
    {
      id: 'ord-004',
      orderNumber: 'WP2024001237',
      date: '2024-12-02',
      status: 'pending',
      items: [
        { id: 'p6', name: 'GPS Pet Collar Tracker', quantity: 1, price: 4299, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200' }
      ],
      totalAmount: 4299,
      deliveryAddress: '123, MG Road, Bangalore',
      estimatedDelivery: '2024-12-07'
    }
  ];

  useEffect(() => {
    fetchOrders();
  }, [phone]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/orders/customer/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform orders to match our interface
        const transformedOrders = data.orders.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          date: new Date(order.createdAt).toISOString().split('T')[0],
          status: order.status,
          items: order.items.map((item: any) => ({
            id: item.productId,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            image: item.image
          })),
          totalAmount: order.pricing.total,
          deliveryAddress: order.address ? `${order.address.line1}, ${order.address.city}` : 'Not specified',
          estimatedDelivery: order.estimatedDelivery,
          trackingNumber: order.trackingNumber
        }));
        setOrders(transformedOrders);
      } else {
        // Fallback to mock data if API fails
        setOrders(mockOrders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Use mock data as fallback
      setOrders(mockOrders);
    } finally {
      setLoading(false);
    }
  };



  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'shipped': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      shipped: 'bg-purple-100 text-purple-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return (
      <Badge className={styles[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filterOrders = (orders: Order[], tab: string) => {
    if (tab === 'all') return orders;
    return orders.filter(order => order.status === tab);
  };

  const filteredOrders = filterOrders(orders, activeTab).filter(order =>
    searchQuery === '' || 
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg flex-1">My Orders</h1>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Filter className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by order number or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
          <TabsList className="w-full grid grid-cols-5 h-auto p-1 bg-gray-100">
            <TabsTrigger value="all" className="text-xs py-2">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs py-2">Pending</TabsTrigger>
            <TabsTrigger value="shipped" className="text-xs py-2">Shipped</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs py-2">Delivered</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs py-2">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Orders List */}
      <div className="p-4 pb-24">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => onOrderClick(order)}
                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    <div>
                      <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Order Items Preview */}
                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-600 font-medium">+{order.items.length - 3}</span>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
                  <span className="font-bold text-gray-900">₹{order.totalAmount}</span>
                </div>

                {/* Estimated Delivery */}
                {order.status !== 'delivered' && order.status !== 'cancelled' && order.estimatedDelivery && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Estimated delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-[#FF8C42] font-medium">View Details</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Box className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No orders found</h2>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Try a different search term' : 'You haven\'t placed any orders yet'}
            </p>
            {!searchQuery && (
              <Button 
                onClick={onBack}
                className="bg-[#FF8C42] hover:bg-[#FF7028] text-white"
              >
                Start Shopping
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
