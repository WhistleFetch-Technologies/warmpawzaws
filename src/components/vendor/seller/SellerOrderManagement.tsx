import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Filter, Eye, Package, Truck, CheckCircle, XCircle, Clock, LayoutGrid, List as ListIcon } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ScrollArea } from '../../ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface SellerOrderManagementProps {
  sellerId: string;
}

export function SellerOrderManagement({ sellerId }: SellerOrderManagementProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

  useEffect(() => {
    loadOrders();
  }, [sellerId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/orders?sellerId=${sellerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string, trackingNumber?: string) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/order/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus, trackingNumber })
        }
      );

      if (res.ok) {
        toast.success('Order status updated');
        loadOrders();
        setSelectedOrder(null);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    const matchesSearch = order.id.includes(searchQuery) || 
                          order.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusConfig: any = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock, border: 'border-yellow-200' },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700', icon: Package, border: 'border-blue-200' },
    shipped: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck, border: 'border-purple-200' },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle, border: 'border-green-200' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle, border: 'border-red-200' }
  };

  const kanbanColumns = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-black">Order Management</h1>
          <p className="text-gray-500 mt-1">Manage and fulfill your customer orders</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
           <Button 
             variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
             size="sm" 
             onClick={() => setViewMode('kanban')}
             className="gap-2"
           >
             <LayoutGrid className="h-4 w-4" /> Kanban
           </Button>
           <Button 
             variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
             size="sm" 
             onClick={() => setViewMode('list')}
             className="gap-2"
           >
             <ListIcon className="h-4 w-4" /> List
           </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        {Object.entries(statusConfig).map(([status, config]: [string, any]) => {
          const count = orders.filter(o => o.status === status).length;
          const Icon = config.icon;
          
          return (
            <Card key={status} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{config.label}</p>
                  <p className="text-xl font-bold text-black">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {viewMode === 'list' && (
             <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                   <SelectValue placeholder="All Orders" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    {Object.entries(statusConfig).map(([status, config]: [string, any]) => (
                        <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                </SelectContent>
             </Select>
          )}
        </div>
      </div>

      {/* Orders View */}
      {viewMode === 'kanban' ? (
         <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max h-full">
               {kanbanColumns.map(status => {
                  const config = statusConfig[status];
                  const columnOrders = filteredOrders.filter(o => o.status === status);
                  
                  return (
                     <div key={status} className="w-80 flex flex-col bg-gray-50 rounded-lg border h-full max-h-[calc(100vh-300px)]">
                        <div className={`p-3 font-semibold text-sm flex justify-between items-center border-b bg-white rounded-t-lg ${config.color}`}>
                           <span>{config.label}</span>
                           <Badge variant="outline" className="bg-white/50">{columnOrders.length}</Badge>
                        </div>
                        <ScrollArea className="flex-1 p-2">
                           <div className="space-y-2">
                              {columnOrders.map(order => {
                                 const sellerItems = order.items?.filter((item: any) => item.sellerId === sellerId) || [];
                                 const sellerTotal = sellerItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                                 
                                 return (
                                    <div 
                                       key={order.id} 
                                       className="bg-white p-3 rounded border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                       onClick={() => setSelectedOrder(order)}
                                    >
                                       <div className="flex justify-between items-start mb-2">
                                          <span className="text-xs font-mono text-gray-500">#{order.id.slice(-6)}</span>
                                          <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                                       </div>
                                       <div className="font-medium text-sm mb-1">{order.customerName || 'Unknown Customer'}</div>
                                       <div className="text-xs text-gray-500 mb-2">{sellerItems.length} items • ₹{sellerTotal.toLocaleString()}</div>
                                       <div className="flex justify-end">
                                          <Button size="sm" variant="ghost" className="h-6 text-xs">View</Button>
                                       </div>
                                    </div>
                                 );
                              })}
                              {columnOrders.length === 0 && (
                                 <div className="text-center py-8 text-gray-400 text-xs">
                                    No orders
                                 </div>
                              )}
                           </div>
                        </ScrollArea>
                     </div>
                  );
               })}
            </div>
         </div>
      ) : (
         <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            <div className="overflow-x-auto h-full">
            <table className="w-full">
               <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Items
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Actions
                  </th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                  <tr>
                     <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No orders found</p>
                     </td>
                  </tr>
                  ) : (
                  filteredOrders.map((order) => {
                     const config = statusConfig[order.status] || statusConfig.pending;
                     const Icon = config.icon;
                     const sellerItems = order.items?.filter((item: any) => item.sellerId === sellerId) || [];
                     const sellerTotal = sellerItems.reduce((sum: number, item: any) => 
                        sum + (item.price * item.quantity), 0
                     );
                     
                     return (
                        <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                           <p className="font-mono text-sm text-black">#{order.id.slice(-8)}</p>
                        </td>
                        <td className="px-6 py-4">
                           <p className="text-sm font-medium text-black">{order.customerName || 'N/A'}</p>
                           <p className="text-xs text-gray-500">{order.customerPhone}</p>
                        </td>
                        <td className="px-6 py-4">
                           <p className="text-sm text-gray-600">
                              {new Date(order.createdAt).toLocaleDateString()}
                           </p>
                           <p className="text-xs text-gray-500">
                              {new Date(order.createdAt).toLocaleTimeString()}
                           </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className="text-sm font-medium text-black">{sellerItems.length}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <p className="font-semibold text-black">₹{sellerTotal.toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.color}`}>
                              <Icon className="w-3 h-3" />
                              {config.label}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                              className="inline-flex items-center gap-1"
                           >
                              <Eye className="w-4 h-4" />
                              View
                           </Button>
                        </td>
                        </tr>
                     );
                  })
                  )}
               </tbody>
            </table>
            </div>
         </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          sellerId={sellerId}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={handleStatusUpdate}
          statusConfig={statusConfig}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ order, sellerId, onClose, onStatusUpdate, statusConfig }: any) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');

  const sellerItems = order.items?.filter((item: any) => item.sellerId === sellerId) || [];
  const sellerTotal = sellerItems.reduce((sum: number, item: any) => 
    sum + (item.price * item.quantity), 0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-black">Order Details - #{order.id.slice(-8)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-black mb-3">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="text-black font-medium">{order.customerName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="text-black font-medium">{order.customerPhone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Delivery Address</p>
                <p className="text-black font-medium">{order.deliveryAddress || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-black mb-3">Order Items</h3>
            <div className="space-y-3">
              {sellerItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl">
                      {item.emoji || '📦'}
                    </div>
                    <div>
                      <p className="font-medium text-black">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-black">₹{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between text-lg font-semibold text-black">
              <span>Total Amount</span>
              <span>₹{sellerTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Status Update */}
          <div>
            <h3 className="font-semibold text-black mb-3">Update Order Status</h3>
            <div className="space-y-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                    {Object.entries(statusConfig).map(([status, config]: [string, any]) => (
                        <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {(newStatus === 'shipped' || newStatus === 'delivered') && (
                <Input
                  type="text"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              )}

              <Button
                onClick={() => onStatusUpdate(order.id, newStatus, trackingNumber)}
                className="w-full bg-[#FF8C42] hover:bg-[#E67A32]"
              >
                Update Status
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
