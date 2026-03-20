'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { LogisticsPartnerAssignment } from './LogisticsPartnerAssignment'; // ✅ FIX GAP-8.3: Logistics partner integration
import { PerforaInvoiceUpload } from './PerforaInvoiceUpload';
import { toast } from 'sonner';

// 2D Sketch-style SVG Icons
const Icons = {
  pill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 21s-8-7.5-8-12a8 8 0 1116 0c0 4.5-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
      <path d="M8 10h8M8 14h4" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  alertCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  dollarSign: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
};

// Types (match backend GET /pharmacy/orders/incoming/:vendorId)
interface IncomingOrder {
  id?: string;
  order_id: string;
  order_number?: string;
  broadcast_id?: string;
  customer_name: string;
  customer_phone: string;
  distance_from_customer?: number;
  distance_km?: number;
  delivery_fee: number;
  eta_minutes?: number;
  expiresIn: number;
  prescription_id?: string;
  prescription_url?: string;
  items: Array<{ id?: string; product_name?: string; medicine_name?: string; name?: string; quantity: number }>;
  prescription?: {
    medication_name: string;
    dosage: string;
    frequency: string;
    vet_name: string;
  };
}

interface ActiveOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  distance_km: number;
  delivery_fee: number;
  eta_minutes: number;
  total_amount: number;
  items: Array<{ id: string; product_name: string; quantity: number; unit_price?: number }>;
}

interface PharmacyOrderDashboardProps {
  vendorId: string;
  vendorName?: string;
  onBack?: () => void;
}

export default function PharmacyOrderDashboard({ vendorId, vendorName, onBack }: PharmacyOrderDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'incoming' | 'active' | 'completed'>('incoming');
  const [incomingOrders, setIncomingOrders] = useState<IncomingOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<IncomingOrder | ActiveOrder | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<Array<{ name: string; price: number; quantity: number }>>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch incoming orders
  const fetchIncomingOrders = useCallback(async () => {
    try {
      const response = await apiClient.get(`/pharmacy/orders/incoming/${vendorId}`);
      if (response && (response as any).success) {
        const data = response as any;
        setIncomingOrders(data.incomingOrders ?? data.orders ?? []);
      }
    } catch (error) {
      console.error('Error fetching incoming orders:', error);
    }
  }, [vendorId]);

  // Fetch active orders
  // Includes: accepted (newly accepted), invoice_generated, payment_confirmed, preparing, dispatched
  // Note: 'accepted' is included to show orders that were just accepted but invoice not yet generated
  const fetchActiveOrders = useCallback(async () => {
    try {
      const response = await apiClient.get(`/pharmacy/${vendorId}/orders?status=accepted,invoice_generated,payment_confirmed,preparing,dispatched`);
      if (response && (response as any).success) {
        setActiveOrders((response as any).orders || []);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
    }
  }, [vendorId]);

  // Fetch completed orders
  const fetchCompletedOrders = useCallback(async () => {
    try {
      const response = await apiClient.get(`/pharmacy/${vendorId}/orders?status=delivered`);
      if (response && (response as any).success) {
        setCompletedOrders((response as any).orders || []);
      }
    } catch (error) {
      console.error('Error fetching completed orders:', error);
    }
  }, [vendorId]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchIncomingOrders(), fetchActiveOrders(), fetchCompletedOrders()]);
      setLoading(false);
    };
    fetchAll();

    // Poll for incoming orders every 30 seconds
    const interval = setInterval(fetchIncomingOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchIncomingOrders, fetchActiveOrders, fetchCompletedOrders]);

  // Refresh all
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchIncomingOrders(), fetchActiveOrders(), fetchCompletedOrders()]);
    setRefreshing(false);
  };

  // Accept order
  const handleAcceptOrder = async (order: IncomingOrder) => {
    try {
      const response = await apiClient.post(`/pharmacy/orders/${order.order_id}/accept`, {
        pharmacyId: vendorId,
        availableItems: (order.items || []).map((i: any) => i.product_name || i.medicine_name || i.name || 'Item'),
        unavailableItems: [],
      });

      if (response && (response as any).success) {
        // Open invoice modal
        setSelectedOrder(order);
        setInvoiceItems(order.items.map(i => ({
          name: i.product_name || i.medicine_name || i.name || 'Item',
          price: Number(i.unit_price ?? i.price ?? 0) || 0,
          quantity: i.quantity,
        })));
        setShowInvoiceModal(true);
        await fetchIncomingOrders();
        await fetchActiveOrders();
      }
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  // Reject order
  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      await apiClient.post(`/pharmacy/orders/${orderId}/reject`, {
        pharmacyId: vendorId,
        reason,
      });
      await fetchIncomingOrders();
    } catch (error) {
      console.error('Error rejecting order:', error);
    }
  };

  // Open invoice modal for accepted orders
  // This allows pharmacy to generate invoice for orders that were already accepted
  const handleOpenInvoiceModal = (order: ActiveOrder) => {
    // Initialize invoice items from order items, or create placeholder if no items exist
    const existingItems = (order.items || []).map((item: any) => ({
      name: item.product_name || item.medicine_name || item.name || 'Medicine',
      quantity: item.quantity || 1,
      price: item.unit_price || item.price || 0,
    }));

    // If no items exist, add a placeholder item for the pharmacy to fill
    if (existingItems.length === 0) {
      existingItems.push({
        name: 'Medicine',
        quantity: 1,
        price: 0,
      });
    }

    setInvoiceItems(existingItems);
    setSelectedOrder(order as any);
    setShowInvoiceModal(true);
  };

  // Generate invoice (proforma: subtotal + delivery + platform + convenience)
  // Works with both IncomingOrder (when accepting) and ActiveOrder (when generating invoice for accepted orders)
  const handleGenerateInvoice = async () => {
    if (!selectedOrder) return;

    // Get order ID - works for both IncomingOrder (order_id) and ActiveOrder (id)
    const orderId = (selectedOrder as any).order_id || (selectedOrder as any).id;
    if (!orderId) {
      toast.error('Order ID not found');
      return;
    }

    // Validate invoice items
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    // Validate that all items have prices
    const itemsWithoutPrice = invoiceItems.filter(item => !item.price || item.price <= 0);
    if (itemsWithoutPrice.length > 0) {
      toast.error('Please set prices for all items');
      return;
    }

    try {
      const response = await apiClient.post(`/pharmacy/orders/${orderId}/invoice`, {
        invoiceItems: invoiceItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
        })),
      });

      if (response && (response as any).success) {
        setShowInvoiceModal(false);
        setSelectedOrder(null);
        setInvoiceItems([]);
        await fetchActiveOrders();
        await fetchIncomingOrders(); // Refresh incoming orders in case status changed
        toast.success('Invoice sent to customer');
      }
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      toast.error(error?.message || 'Failed to send invoice');
    }
  };

  // Dispatch order
  const handleDispatchOrder = async (orderId: string) => {
    try {
      await apiClient.post(`/pharmacy/orders/${orderId}/dispatch`, {
        deliveryPartner: 'Own Fleet',
        deliveryPartnerName: 'Pharmacy Delivery',
      });
      await fetchActiveOrders();
    } catch (error) {
      console.error('Error dispatching order:', error);
    }
  };

  // Complete order
  const handleCompleteOrder = async (orderId: string) => {
    try {
      await apiClient.post(`/pharmacy/orders/${orderId}/complete`, {});
      await fetchActiveOrders();
      await fetchCompletedOrders();
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'broadcast':
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed':
      case 'invoice_generated':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'payment_confirmed':
      case 'preparing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'dispatched':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      broadcast: 'Broadcasting',
      confirmed: 'Confirmed',
      invoice_generated: 'Invoice Sent',
      payment_confirmed: 'Payment Done',
      preparing: 'Preparing',
      dispatched: 'Out for Delivery',
      delivered: 'Delivered',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack ?? (() => router.push('/'))}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Back to dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white">
                {Icons.pill}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">{vendorName || 'Pharmacy'}</h1>
                <p className="text-sm text-slate-500">Order Management</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            >
              <span className={refreshing ? 'animate-spin' : ''}>{Icons.refresh}</span>
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'incoming', label: 'Incoming', icon: Icons.bell, count: incomingOrders.length },
              { id: 'active', label: 'Active', icon: Icons.box, count: activeOrders.length },
              { id: 'completed', label: 'Completed', icon: Icons.check, count: completedOrders.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'incoming' | 'active' | 'completed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Incoming Orders */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            {incomingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {Icons.clipboard}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Incoming Orders</h3>
                <p className="text-slate-500">New prescription orders will appear here</p>
              </div>
            ) : (
              incomingOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Order Header */}
                  <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                          {Icons.receipt}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{order.order_number || order.order_id?.slice(0, 8)}</h3>
                          <p className="text-sm text-slate-500">{order.customer_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-amber-600">
                          {Icons.clock}
                          <span className="text-sm font-medium">Expires in {Math.floor(order.expiresIn / 60)}:{(order.expiresIn % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1 justify-end mt-1">
                          {Icons.mapPin}
                          {(order.distance_km ?? order.distance_from_customer ?? 0)} km away
                          {((o: any) => {
                            const lat = o.customer_lat ?? o.delivery_latitude ?? o.delivery_address?.latitude ?? o.delivery_address?.lat;
                            const lng = o.customer_lng ?? o.delivery_longitude ?? o.delivery_address?.longitude ?? o.delivery_address?.lng;
                            const addr = [o.delivery_address?.addressLine1, o.delivery_address?.city, o.delivery_address?.pincode].filter(Boolean).join(', ');
                            if (lat != null && lng != null) {
                              return (
                                <a
                                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-amber-600 hover:text-amber-700 text-xs font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View on Map
                                </a>
                              );
                            }
                            if (addr) {
                              return (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-amber-600 hover:text-amber-700 text-xs font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View on Map
                                </a>
                              );
                            }
                            return null;
                          })(order)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    {(order.prescription || (order as any).prescription_url || (order as any).prescription_id) && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between gap-2 text-blue-700">
                          <div className="flex items-center gap-2">
                            {Icons.clipboard}
                            <span className="text-sm font-medium">
                              {order.prescription ? `Prescription from ${order.prescription.vet_name || 'Doctor'}` : 'Prescription attached'}
                            </span>
                          </div>
                          {((order as any).prescription_url) ? (
                            <a
                              href={(order as any).prescription_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                            >
                              View Prescription
                            </a>
                          ) : (order as any).prescription_id ? (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await apiClient.get(`/prescriptions/${(order as any).prescription_id}?includeDetails=true`) as any;
                                  const url = res?.prescription?.file_url || res?.file_url;
                                  if (url) window.open(url, '_blank');
                                  else toast.error('Prescription not available');
                                } catch {
                                  toast.error('Could not load prescription');
                                }
                              }}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                            >
                              View Prescription
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                              {Icons.pill}
                            </div>
                            <span className="text-slate-700">{item.product_name || item.medicine_name || item.name || 'Item'}</span>
                          </div>
                          <span className="text-slate-500 text-sm">Qty: {item.quantity ?? 1}</span>
                        </div>
                      ))}
                      {(!order.items || order.items.length === 0) && (
                        <p className="text-slate-500 text-sm py-2">Prescription order — add items in invoice</p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">{Icons.truck} ETA: {order.eta_minutes} min</span>
                        <span className="flex items-center gap-1">{Icons.dollarSign} Delivery: ₹{order.delivery_fee}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectOrder(order.order_id, 'Items unavailable')}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                        >
                          {Icons.x}
                          <span className="text-sm font-medium">Reject</span>
                        </button>
                        <button
                          onClick={() => handleAcceptOrder(order)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          {Icons.check}
                          <span className="text-sm font-medium">Accept</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Active Orders */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {Icons.box}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Active Orders</h3>
                <p className="text-slate-500">Accept incoming orders to see them here</p>
              </div>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                          {Icons.box}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{order.order_number}</h3>
                          <p className="text-sm text-slate-500">{order.customer_name} • {order.customer_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const o = order as any;
                          const lat = o.customer_lat ?? o.delivery_latitude ?? o.delivery_address?.latitude ?? o.delivery_address?.lat;
                          const lng = o.customer_lng ?? o.delivery_longitude ?? o.delivery_address?.longitude ?? o.delivery_address?.lng;
                          const addr = [o.delivery_address?.addressLine1, o.delivery_address?.city, o.delivery_address?.pincode].filter(Boolean).join(', ');
                          if (lat != null && lng != null) {
                            return (
                              <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1">
                                {Icons.mapPin} Map
                              </a>
                            );
                          }
                          if (addr) {
                            return (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1">
                                {Icons.mapPin} Map
                              </a>
                            );
                          }
                          return null;
                        })()}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {((order as any).prescription_url || (order as any).prescription_id) && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-700">Prescription</span>
                          {(order as any).prescription_url ? (
                            <a href={(order as any).prescription_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 underline">
                              View Prescription
                            </a>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await apiClient.get(`/prescriptions/${(order as any).prescription_id}?includeDetails=true`) as any;
                                  const url = res?.prescription?.file_url || res?.file_url;
                                  if (url) window.open(url, '_blank');
                                  else toast.error('Prescription not available');
                                } catch {
                                  toast.error('Could not load prescription');
                                }
                              }}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                            >
                              View Prescription
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 mb-4">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <span className="text-slate-700">{item.product_name || item.medicine_name || item.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500 text-sm">Qty: {item.quantity}</span>
                            {item.unit_price && (
                              <span className="text-slate-700 font-medium">₹{item.unit_price}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Upload window: Perfora invoice file (image/PDF) for pharmacy orders */}
                    {(order.status === 'confirmed' || order.status === 'invoice_generated') && (
                      <div className="mb-4 pt-4 border-t border-slate-100">
                        <PerforaInvoiceUpload
                          orderId={order.id}
                          onUploadComplete={() => {
                            fetchActiveOrders();
                          }}
                        />
                      </div>
                    )}

                    {/* ✅ FIX GAP-8.3: Logistics Partner Assignment */}
                    {(order.status === 'payment_confirmed' || order.status === 'preparing' || order.status === 'dispatched') && (
                      <div className="mb-4 pt-4 border-t border-slate-100">
                        <LogisticsPartnerAssignment
                          orderId={order.id}
                          pickupAddress={{
                            addressLine1: (order as any).pharmacy_address?.addressLine1 || (order as any).pickup_address?.addressLine1 || 'Pharmacy Address',
                            city: (order as any).pharmacy_address?.city || (order as any).pickup_address?.city || '',
                            pincode: (order as any).pharmacy_address?.pincode || (order as any).pickup_address?.pincode || '',
                            latitude: (order as any).pharmacy_latitude || (order as any).pickup_latitude || 0,
                            longitude: (order as any).pharmacy_longitude || (order as any).pickup_longitude || 0,
                          }}
                          deliveryAddress={{
                            addressLine1: (order as any).delivery_address?.addressLine1 || (order as any).customer_address?.addressLine1 || (order as any).deliveryAddress?.addressLine1 || 'Customer Address',
                            city: (order as any).delivery_address?.city || (order as any).customer_address?.city || (order as any).deliveryAddress?.city || '',
                            pincode: (order as any).delivery_address?.pincode || (order as any).customer_address?.pincode || (order as any).deliveryAddress?.pincode || '',
                            latitude: (order as any).delivery_latitude || (order as any).customer_latitude || (order as any).deliveryAddress?.latitude || 0,
                            longitude: (order as any).delivery_longitude || (order as any).customer_longitude || (order as any).deliveryAddress?.longitude || 0,
                          }}
                          items={(order.items || []).map((item: any) => ({
                            name: item.product_name || item.name || item.medicine_name || 'Item',
                            quantity: item.quantity ?? 1,
                          }))}
                          onPartnerAssigned={(partnerId) => {
                            console.log('Partner assigned:', partnerId);
                            fetchActiveOrders(); // Refresh orders
                          }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="text-lg font-semibold text-slate-800">
                        Total: ₹{order.total_amount || 0}
                      </div>

                      {/* Generate Invoice button for accepted orders */}
                      {order.status === 'accepted' && (
                        <button
                          onClick={() => handleOpenInvoiceModal(order)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          {Icons.receipt}
                          <span className="text-sm font-medium">Generate Invoice</span>
                        </button>
                      )}

                      {order.status === 'payment_confirmed' && (
                        <button
                          onClick={() => handleDispatchOrder(order.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                          {Icons.truck}
                          <span className="text-sm font-medium">Dispatch</span>
                        </button>
                      )}

                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => handleCompleteOrder(order.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          {Icons.check}
                          <span className="text-sm font-medium">Mark Delivered</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Completed Orders */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            {completedOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {Icons.check}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Completed Orders</h3>
                <p className="text-slate-500">Delivered orders will appear here</p>
              </div>
            ) : (
              completedOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-4 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                        {Icons.check}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{order.order_number}</h3>
                        <p className="text-sm text-slate-500">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-slate-800">₹{order.total_amount}</span>
                      <p className="text-sm text-emerald-600">Delivered</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Invoice Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {Icons.receipt}
                Generate Invoice
              </h2>
              <p className="text-sm text-slate-500">
                Order {(selectedOrder as any).order_number || (selectedOrder as any).order_id?.slice(0, 8) || 'N/A'}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {invoiceItems.map((item, idx) => {
                const itemPrice = parseFloat(String(item.price || 0)) || 0;
                const itemQuantity = parseInt(String(item.quantity || 1)) || 1;
                const itemTotal = itemPrice * itemQuantity;
                
                return (
                  <div key={idx} className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...invoiceItems];
                          newItems[idx].name = e.target.value;
                          setInvoiceItems(newItems);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        placeholder="Medicine name"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || 1}
                          onChange={(e) => {
                            const newItems = [...invoiceItems];
                            const qty = parseInt(e.target.value, 10);
                            newItems[idx].quantity = (isNaN(qty) || qty < 1) ? 1 : qty;
                            setInvoiceItems(newItems);
                          }}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                        <span className="text-xs text-slate-400">×</span>
                        <span className="text-xs text-slate-500">₹{itemPrice.toFixed(2)}</span>
                        <span className="text-xs text-slate-400">=</span>
                        <span className="text-xs font-medium text-slate-700">₹{itemTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price || 0}
                          onChange={(e) => {
                            const newItems = [...invoiceItems];
                            const price = parseFloat(e.target.value);
                            newItems[idx].price = (isNaN(price) || price < 0) ? 0 : price;
                            setInvoiceItems(newItems);
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-right"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newItems = invoiceItems.filter((_, i) => i !== idx);
                        setInvoiceItems(newItems);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      {Icons.x}
                    </button>
                  </div>
                );
              })}

              {/* Add Item Button */}
              <button
                onClick={() => {
                  setInvoiceItems([...invoiceItems, { name: 'Medicine', quantity: 1, price: 0 }]);
                }}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                <span className="text-sm font-medium">Add Item</span>
              </button>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                {(() => {
                  // Calculate values safely, excluding items with zero price or quantity
                  // Only include items that have both a valid price (> 0) and quantity (> 0)
                  const validItems = invoiceItems.filter(i => {
                    const price = parseFloat(String(i.price || 0)) || 0;
                    const quantity = parseInt(String(i.quantity || 0)) || 0;
                    return price > 0 && quantity > 0;
                  });
                  
                  const subtotal = validItems.reduce((sum, i) => {
                    const price = parseFloat(String(i.price || 0)) || 0;
                    const quantity = parseInt(String(i.quantity || 1)) || 1;
                    return sum + (price * quantity);
                  }, 0);
                  
                  const tax = subtotal * 0.05;
                  const deliveryFee = parseFloat(String((selectedOrder as any).delivery_fee || 40)) || 40;
                  const total = subtotal + tax + deliveryFee;
                  
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="text-slate-700">₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tax (5%)</span>
                        <span className="text-slate-700">₹{tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Delivery Fee</span>
                        <span className="text-slate-700">₹{deliveryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-100">
                        <span className="text-slate-800">Total</span>
                        <span className="text-slate-800">₹{total.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedOrder(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
