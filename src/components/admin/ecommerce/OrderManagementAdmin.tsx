import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Filter, ChevronRight, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { LoadingState, ErrorState, EmptyState } from '../../ui/states';
import { ShiprocketOrderIntegration } from './ShiprocketOrderIntegration';

export function OrderManagementAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetails(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_BASE}/ecommerce/orders`, // Using the actual orders endpoint
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (id: string) => {
     try {
       // Fetch full order details from API
       const response = await fetch(
        `${API_BASE}/ecommerce/order/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data.order);
      } else {
        throw new Error('Failed to fetch order details');
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Failed to load order details');
    }
  };

  if (selectedOrderId && selectedOrder) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedOrderId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Order #{selectedOrder.orderNumber}</h1>
          <Badge>{selectedOrder.status}</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Items</h3>
              <div className="space-y-4">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">₹{item.price * item.quantity}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between font-bold">
                <span>Total</span>
                <span>₹{selectedOrder.amount || selectedOrder.items?.reduce((a: any, b: any) => a + (b.price * b.quantity), 0)}</span>
              </div>
            </Card>
            
            {/* Shiprocket Integration */}
            <ShiprocketOrderIntegration 
              orderId={selectedOrderId} 
              order={selectedOrder} 
              onUpdate={() => fetchOrderDetails(selectedOrderId)}
            />
          </div>

          <div className="space-y-6">
            {/* Customer Details */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Customer Details</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Name:</span> {selectedOrder.address?.fullName || selectedOrder.customerName}</p>
                <p><span className="text-gray-500">Phone:</span> {selectedOrder.address?.phone}</p>
                <p><span className="text-gray-500">Address:</span></p>
                <p className="text-gray-700">
                  {selectedOrder.address?.street}<br/>
                  {selectedOrder.address?.city}, {selectedOrder.address?.zipCode}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-black text-xl font-semibold">Order Management</h2>
          <p className="text-gray-500 text-sm mt-1">View and manage all marketplace orders</p>
        </div>
        <div className="flex gap-2">
           <Input placeholder="Search orders..." className="w-64" prefix={<Search className="w-4 h-4 text-gray-400" />} />
           <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading orders..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : orders.length === 0 ? (
        <EmptyState message="No orders found" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900">Order ID</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Customer</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Date</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Amount</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Logistics</th>
                <th className="px-6 py-4 font-semibold text-gray-900"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr 
                  key={order.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <td className="px-6 py-4 font-medium text-blue-600">{order.orderNumber}</td>
                  <td className="px-6 py-4 text-gray-900">{order.customerName}</td>
                  <td className="px-6 py-4 text-gray-500">{order.date}</td>
                  <td className="px-6 py-4 font-medium">₹{order.amount}</td>
                  <td className="px-6 py-4">
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                     {order.shiprocketOrderId ? (
                       <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                         Integrated
                       </Badge>
                     ) : (
                       <span className="text-gray-400">-</span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}