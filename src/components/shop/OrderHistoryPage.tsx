import React, { useState } from 'react';
import { Package, Truck, CheckCircle, Clock, Search, XCircle, RefreshCw } from 'lucide-react';
import { CustomerProfileLayout } from './CustomerProfileLayout';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

// Mock Orders Data
const MOCK_ORDERS = [
  {
    id: 'ORD-2025-001',
    date: 'Jan 24, 2025',
    total: 2899,
    status: 'Processing',
    items: [
      {
        id: '1',
        title: 'Royal Canin Adult Golden Retriever Dog Food (3kg)',
        image: 'https://images.unsplash.com/photo-1764249453874-46864677b10e?q=80&w=200',
        qty: 1,
        price: 2400
      },
      {
        id: '2',
        title: 'Interactive Cat Laser Toy',
        image: 'https://images.unsplash.com/photo-1729008764855-9b5257318beb?q=80&w=200',
        qty: 2,
        price: 899
      }
    ],
    tracking: {
       step: 2, // 1: Placed, 2: Packed, 3: Shipped, 4: Delivered
       estimatedDelivery: 'Jan 27, 2025'
    }
  },
  {
    id: 'ORD-2024-892',
    date: 'Dec 15, 2024',
    total: 499,
    status: 'Delivered',
    items: [
      {
        id: '3',
        title: 'Pet Grooming Glove Kit',
        image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200',
        qty: 1,
        price: 499
      }
    ],
    tracking: {
       step: 4,
       deliveredDate: 'Dec 18, 2024'
    }
  },
  {
    id: 'ORD-2024-750',
    date: 'Nov 02, 2024',
    total: 1250,
    status: 'Cancelled',
    items: [
      {
        id: '4',
        title: 'Large Dog Bed (Washable)',
        image: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=200',
        qty: 1,
        price: 1250
      }
    ],
    tracking: {
       step: 0
    }
  }
];

const STATUS_COLORS: Record<string, string> = {
  'Processing': 'bg-blue-100 text-blue-700',
  'Shipped': 'bg-amber-100 text-amber-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, any> = {
  'Processing': Clock,
  'Shipped': Truck,
  'Delivered': CheckCircle,
  'Cancelled': XCircle,
};

interface OrderHistoryPageProps {
  onNavigate: (path: string) => void;
}

export function OrderHistoryPage({ onNavigate }: OrderHistoryPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredOrders = MOCK_ORDERS.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.items.some(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filter === 'all' || order.status.toLowerCase() === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <CustomerProfileLayout currentPath="account/orders" onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <h2 className="text-xl font-semibold">Order History</h2>
           <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search orders or products..." 
                className="pl-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="processing">Open</TabsTrigger>
                <TabsTrigger value="delivered">Past</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="space-y-4">
           {filteredOrders.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50">
                 <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                 <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
                 <p className="text-muted-foreground">Try changing your search or filter.</p>
              </div>
           ) : (
              filteredOrders.map((order) => {
                 const StatusIcon = STATUS_ICONS[order.status] || Package;
                 return (
                    <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardHeader className="bg-gray-50/50 px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
                            <div className="flex gap-4 items-center">
                                <div className={`p-2 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                                    <StatusIcon className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{order.id}</span>
                                        <span className="text-xs text-muted-foreground">• {order.date}</span>
                                    </div>
                                    <div className="text-xs font-medium mt-0.5">Total: ₹{order.total.toLocaleString()}</div>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="text-xs h-8">View Details</Button>
                        </CardHeader>
                        <CardContent className="p-6">
                            {/* Tracking Bar (Simplified) */}
                            {order.status !== 'Cancelled' && (
                                <div className="mb-6">
                                    <div className="relative">
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                                            <div style={{ width: `${(order.tracking.step / 4) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 transition-all duration-500"></div>
                                        </div>
                                        <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                            <span className={order.tracking.step >= 1 ? 'text-green-600' : ''}>Order Placed</span>
                                            <span className={order.tracking.step >= 2 ? 'text-green-600' : ''}>Packed</span>
                                            <span className={order.tracking.step >= 3 ? 'text-green-600' : ''}>Shipped</span>
                                            <span className={order.tracking.step >= 4 ? 'text-green-600' : ''}>Delivered</span>
                                        </div>
                                        <div className="mt-2 text-xs font-medium text-center text-gray-600">
                                            {order.status === 'Delivered' 
                                                ? `Delivered on ${order.tracking.deliveredDate}` 
                                                : `Arriving by ${order.tracking.estimatedDelivery}`
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex gap-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded border overflow-hidden shrink-0">
                                            <ImageWithFallback src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Qty: {item.qty} × ₹{item.price.toLocaleString()}</p>
                                        </div>
                                        {order.status === 'Delivered' && (
                                            <div className="flex flex-col gap-2 justify-center">
                                                 <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7 hover:bg-blue-50">Write Review</Button>
                                                 <Button variant="ghost" size="sm" className="text-xs h-7 flex gap-1 hover:bg-gray-100">
                                                    <RefreshCw className="h-3 w-3" /> Buy Again
                                                 </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                 );
              })
           )}
        </div>
      </div>
    </CustomerProfileLayout>
  );
}
