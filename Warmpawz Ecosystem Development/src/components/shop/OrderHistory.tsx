import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Filter, ChevronRight, Star, Download, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { authenticatedGet, authenticatedPost } from '../../utils/authenticatedFetch';
import { getApiBaseUrl } from '../../utils/api-config';

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

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  totalAmount: number;
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
  paymentMethod: string;
  trackingNumber?: string;
  deliveredAt?: string;
  canReview: boolean;
  canReturn: boolean;
}

export function OrderHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned'
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, searchQuery, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await authenticatedGet(
        `${getApiBaseUrl()}/customer/orders`,
        true
      );
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(item =>
          item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sellerName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    setFilteredOrders(filtered);
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      const response = await authenticatedGet(
        `${getApiBaseUrl()}/customer/orders/${orderId}/invoice`,
        true
      );
      
      // Create a download link
      const blob = new Blob([response.pdfData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Failed to download invoice');
    }
  };

  const initiateReturn = async (orderId: string) => {
    if (!confirm('Are you sure you want to return this order?')) return;

    try {
      await authenticatedPost(
        `${getApiBaseUrl()}/customer/orders/${orderId}/return`,
        { reason: 'Customer initiated return' },
        true
      );
      alert('Return initiated successfully');
      fetchOrders();
    } catch (error) {
      console.error('Error initiating return:', error);
      alert('Failed to initiate return');
    }
  };

  const getOrderStats = () => {
    return {
      all: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      returned: orders.filter(o => o.status === 'returned').length
    };
  };

  const stats = getOrderStats();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Order History</h1>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders, products, or sellers..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#FF8C42]"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.all})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter('confirmed')}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                statusFilter === 'confirmed'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Confirmed ({stats.confirmed})
            </button>
            <button
              onClick={() => setStatusFilter('shipped')}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                statusFilter === 'shipped'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Shipped ({stats.shipped})
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                statusFilter === 'delivered'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Delivered ({stats.delivered})
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No orders found' : 'No orders yet'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start shopping to see your orders here'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => navigate('/shop')} className="bg-[#FF8C42] hover:bg-[#FF7A2F]">
                Start Shopping
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Order #{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">
                        Placed on {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4">
                  <div className="space-y-3 mb-4">
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/shop/product/${item.productId}`)}
                        className="flex gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      >
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">
                            {item.productName}
                          </h3>
                          <p className="text-xs text-gray-500 mb-1">Sold by {item.sellerName}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                            <span className="font-semibold text-gray-800">₹{item.price}</span>
                          </div>
                        </div>
                        {order.canReview && order.status === 'delivered' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/shop/review/${order.id}/${item.productId}`);
                            }}
                            className="text-[#FF8C42] hover:text-[#FF7A2F] text-sm font-semibold"
                          >
                            <Star className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Order Total */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Total Amount</span>
                    <span className="text-lg font-bold text-gray-800">₹{order.totalAmount}</span>
                  </div>

                  {/* Order Actions */}
                  <div className="flex gap-2 pt-3">
                    <Button
                      onClick={() => navigate(`/shop/orders/${order.id}/track`)}
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <Package className="w-4 h-4" />
                      Track Order
                    </Button>
                    
                    {order.status === 'delivered' && (
                      <Button
                        onClick={() => downloadInvoice(order.id)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Invoice
                      </Button>
                    )}

                    {order.canReturn && order.status === 'delivered' && (
                      <Button
                        onClick={() => initiateReturn(order.id)}
                        variant="outline"
                        className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Return
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
