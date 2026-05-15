'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Package, MapPin, Calendar, Clock, CheckCircle, Truck, Home,
  Key, Eye, EyeOff, Copy, Check, Phone,
  Navigation, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

// Import OrderTrackingScreen
import { OrderTrackingScreen } from '@/components/customer/tracking/OrderTrackingScreen';
import { usePharmacyPayment } from '@/hooks/usePharmacyPayment';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

interface PharmacyOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  payment_status: string;
  payment_method: string;
  delivery_address: any;
  items: any[];
  pharmacy_id?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  created_at: string;
  updated_at: string;
  // Tracking fields
  delivery_otp?: string;
  otp_verified?: boolean;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
}

function PharmacyOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  
  // OTP display states
  const [showOTP, setShowOTP] = useState<Record<string, boolean>>({});
  const [copiedOTP, setCopiedOTP] = useState<string | null>(null);

  // Get customer phone for payment
  const phoneFromUrl = searchParams?.get('phone') || '';
  const customerPhone = phoneFromUrl || localStorage.getItem('customerPhone') || '';

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      if (!customerPhone) {
        setOrders([]);
        return;
      }

      const response: any = await apiClient.get(`/customer/pharmacy/orders?phone=${encodeURIComponent(customerPhone)}`);
      console.log('response', response);
      if (response.success && response.orders) {
        const pharmacyOrders = response.orders.map((o: any) => ({
          id: o.id,
          order_number: o.order_number || o.orderNumber || o.id,
          status: o.status,
          total_amount: o.total || o.total_amount || 0,
          delivery_fee: o.deliveryFee || o.delivery_fee || 0,
          payment_status: o.payment_status || o.paymentStatus || 'pending',
          payment_method: o.payment_method || o.paymentMethod || 'online',
          delivery_address: o.deliveryAddress || o.delivery_address || {},
          items: o.items || [],
          pharmacy_id: o.pharmacy_id || o.pharmacyId,
          pharmacy_name: o.pharmacyName || o.pharmacy_name,
          pharmacy_phone: o.pharmacyPhone || o.pharmacy_phone,
          created_at: o.createdAt || o.created_at || new Date().toISOString(),
          updated_at: o.updatedAt || o.updated_at || new Date().toISOString(),
          delivery_otp: o.delivery_otp || o.deliveryOtp,
          otp_verified: o.otp_verified || o.otpVerified || false,
          delivery_partner_name: o.delivery_partner_name || o.deliveryPartnerName,
          delivery_partner_phone: o.delivery_partner_phone || o.deliveryPartnerPhone,
        }));
        setOrders(pharmacyOrders);
      }
    } catch (error) {
      console.error('Error loading pharmacy orders:', error);
      toast.error('Failed to load pharmacy orders');
    } finally {
      setLoading(false);
    }
  };

  // Payment hook
  const { completePayment, processingPayment } = usePharmacyPayment({
    customerPhone,
    onPaymentSuccess: loadOrders,
  });

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Copy OTP to clipboard
  const copyOTP = (orderId: string, otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOTP(orderId);
    toast.success('OTP copied to clipboard');
    setTimeout(() => setCopiedOTP(null), 2000);
  };

  // Toggle OTP visibility for an order
  const toggleOTPVisibility = (orderId: string) => {
    setShowOTP(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Check if invoice is generated
  // Invoice is generated when status is 'invoice_generated' or later
  const isInvoiceGenerated = (status: string): boolean => {
    const invoiceGeneratedStatuses = ['invoice_generated', 'invoice_sent', 'payment_confirmed', 'preparing', 'dispatched', 'on_the_way', 'delivered'];
    return invoiceGeneratedStatuses.includes(status.toLowerCase());
  };

  // Get display status: if payment is paid, show 'payment_confirmed', otherwise show actual status
  const getDisplayStatus = (order: PharmacyOrder): string => {
    if (order.payment_status === 'paid') {
      return 'payment_confirmed';
    }
    return order.status;
  };

  // Check if order can be tracked
  // Order can only be tracked if payment is paid and status allows tracking
  const canTrackOrder = (status: string, paymentStatus?: string) => {
    // Payment must be paid to track
    if (paymentStatus && paymentStatus.toLowerCase() !== 'paid') {
      return false;
    }
    
    // Check if status allows tracking
    return ['accepted', 'invoice_generated', 'payment_confirmed', 'preparing', 'dispatched', 'on_the_way', 'delivered'].includes(status.toLowerCase());
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'broadcasting':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'invoice_generated':
        return 'bg-purple-100 text-purple-800';
      case 'payment_confirmed':
        return 'bg-indigo-100 text-indigo-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'dispatched':
      case 'on_the_way':
        return 'bg-cyan-100 text-cyan-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'broadcasting':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
      case 'invoice_generated':
      case 'payment_confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'preparing':
        return <Package className="w-4 h-4" />;
      case 'dispatched':
      case 'on_the_way':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <Home className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatAddress = (address: any): string => {
    if (!address) return 'Address not available';
    if (typeof address === 'string') return address;
    return address.address || address.addressLine1 || `${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`.trim() || 'Address not available';
  };

  const formatPrice = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `₹${num.toFixed(2)}`;
  };

  const pharmacyHeaderStats = useMemo(() => {
    const delivered = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered').length;
    const active = orders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s && !['delivered', 'cancelled', 'rejected'].includes(s);
    }).length;
    return [
      { value: String(orders.length), label: 'Total' },
      { value: String(active), label: 'Active' },
      { value: String(delivered), label: 'Delivered' },
    ];
  }, [orders]);

  // If tracking view is active, show tracking screen
  if (trackingOrderId) {
    return (
      <OrderTrackingScreen
        orderId={trackingOrderId}
        orderType="pharmacy"
        onBack={() => setTrackingOrderId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="Pharmacy Orders"
        serviceSubtitle="Track your medicine orders"
        serviceIcon={Package}
        iconColor="text-white"
        stats={pharmacyHeaderStats}
        onBack={() => goBackOrHome(router)}
        showBackButton
      />

      {/* Orders List */}
      <div className="px-4 py-4 space-y-4 pb-20">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No pharmacy orders</h2>
            <p className="text-gray-500">You haven't placed any pharmacy orders yet</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Order Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">{order.order_number}</h3>
                  </div>
                  {order.pharmacy_name && (
                    <p className="text-sm text-gray-600">{order.pharmacy_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getStatusColor(getDisplayStatus(order))}`}>
                    {getStatusIcon(getDisplayStatus(order))}
                    {getDisplayStatus(order).replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-2 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(order.created_at).toLocaleDateString('en-IN', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{formatAddress(order.delivery_address)}</span>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Invoice Status */}
              {!isInvoiceGenerated(order.status) && (
                <div className="mb-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800 font-medium">
                      📋 Invoice yet to be generated
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Waiting for pharmacy to generate invoice
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Status - only show if invoice is generated */}
              {isInvoiceGenerated(order.status) && order.payment_status && (
                <div className="mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    order.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.payment_status === 'paid' ? '✓ Paid' : `Payment: ${order.payment_status}`}
                  </span>
                </div>
              )}

              {/* Delivery OTP (if available) */}
              {order.delivery_otp && !order.otp_verified && (
                <div className="mb-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Delivery OTP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-orange-600 tracking-wider">
                        {showOTP[order.id] ? order.delivery_otp : '****'}
                      </span>
                      <button
                        onClick={() => toggleOTPVisibility(order.id)}
                        className="p-1 hover:bg-orange-100 rounded"
                      >
                        {showOTP[order.id] ? (
                          <EyeOff className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Eye className="w-4 h-4 text-orange-600" />
                        )}
                      </button>
                      <button
                        onClick={() => copyOTP(order.id, order.delivery_otp!)}
                        className="p-1 hover:bg-orange-100 rounded"
                      >
                        {copiedOTP === order.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-orange-600" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Share this OTP with the delivery person
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <div className="flex-1">
                  <span className="text-lg font-bold text-gray-900">
                    {isInvoiceGenerated(order.status) 
                      ? formatPrice(order.total_amount) 
                      : 'Amount TBD'}
                  </span>
                </div>
                
                {/* Only show payment/track buttons if invoice is generated */}
                {isInvoiceGenerated(order.status) && (
                  <>
                    {/* Complete Payment button - show if payment is NOT paid */}
                    {order.payment_status !== 'paid' && order.payment_method === 'online' && (
                      <button
                        onClick={() => completePayment(order.id, order.total_amount, order.order_number)}
                        disabled={processingPayment === order.id}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        {processingPayment === order.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            Complete Payment
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Track Order button - only show if payment is paid */}
                    {order.payment_status === 'paid' && canTrackOrder(getDisplayStatus(order), order.payment_status) && (
                      <button
                        onClick={() => setTrackingOrderId(order.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <Navigation className="w-4 h-4" />
                        Track Order
                      </button>
                    )}
                  </>
                )}
                
                {order.pharmacy_phone && (
                  <button
                    onClick={() => window.location.href = `tel:${order.pharmacy_phone}`}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PharmacyOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    }>
      <PharmacyOrdersContent />
    </Suspense>
  );
}
