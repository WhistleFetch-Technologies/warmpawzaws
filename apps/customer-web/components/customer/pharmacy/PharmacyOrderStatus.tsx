'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Package, Truck, Building2, Phone, Key, Copy, Eye, EyeOff, Check, FileText, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { DeliveryOTPVerification } from '../DeliveryOTPVerification';
import { PharmacyBroadcastMap, type BroadcastPharmacy } from './PharmacyBroadcastMap';

interface PharmacyOrderStatusProps {
  orderId: string;
  phone: string;
  onBack?: () => void;
  onViewInvoice?: () => void;
}

type OrderStatus = 'broadcasting' | 'accepted' | 'rejected' | 'invoice_generated' | 'payment_confirmed' | 'preparing' | 'ready' | 'dispatched' | 'in_transit' | 'out_for_delivery' | 'arriving' | 'delivered' | 'cancelled';

interface PharmacyOrder {
  id: string;
  status: OrderStatus;
  pharmacyId?: string;
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  estimatedTime?: number; // minutes
  broadcastTime?: string;
  acceptedTime?: string;
  medicines: Array<{
    name: string;
    quantity: number;
    price: number;
    available: boolean;
  }>;
  totalAmount: number;
  proformaInvoice?: {
    id: string;
    total: number;
    items: any[];
  };
  // Delivery OTP fields
  deliveryOtp?: string;
  otpVerified?: boolean;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  deliveryAddress?: any;
  // Broadcast status fields
  currentRadius?: number;
  maxRadius?: number;
  broadcastStartedAt?: string;
}

interface BroadcastStatus {
  pending: number;
  accepted: number;
  rejected: number;
  currentRadius: number;
}

export function PharmacyOrderStatus({ orderId, phone, onBack, onViewInvoice }: PharmacyOrderStatusProps) {
  const [order, setOrder] = useState<PharmacyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus | null>(null);
  const [broadcastList, setBroadcastList] = useState<BroadcastPharmacy[]>([]);

  // OTP display state
  const [showOTP, setShowOTP] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);

  useEffect(() => {
    loadOrderStatus();
    
    // Poll for status updates - faster polling during broadcasting
    if (polling) {
      const pollInterval = order?.status === 'broadcasting' ? 5000 : 10000;
      const interval = setInterval(() => {
        loadOrderStatus();
      }, pollInterval);
      
      return () => clearInterval(interval);
    }
  }, [orderId, polling, order?.status]);

  const loadOrderStatus = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/orders/${orderId}/pharmacy-status`);
      if (response.success || response.order) {
        const orderData = response.order || response;
        
        // Map delivery OTP fields
        setOrder({
          ...orderData,
          deliveryOtp: orderData.delivery_otp || orderData.deliveryOtp || orderData.otp,
          otpVerified: orderData.otp_verified || orderData.otpVerified,
          deliveryPartnerName: orderData.delivery_partner_name || orderData.deliveryPartnerName || orderData.partnerName,
          deliveryPartnerPhone: orderData.delivery_partner_phone || orderData.deliveryPartnerPhone || orderData.partnerPhone,
          deliveryAddress: orderData.delivery_address || orderData.deliveryAddress,
          currentRadius: orderData.currentRadius || orderData.current_broadcast_radius || 5,
          maxRadius: orderData.maxRadius || orderData.max_broadcast_radius || 20,
          broadcastStartedAt: orderData.broadcastStartedAt || orderData.broadcast_started_at,
        });
        
        // If broadcasting, also fetch broadcast status (API returns { success, broadcastStatus: { ... }, broadcasts: [...] })
        if (orderData.status === 'broadcasting') {
          try {
            const broadcastRes = await apiClient.get<any>(`/pharmacy/orders/${orderId}/broadcast-status`);
            if (broadcastRes.success) {
              const bs = broadcastRes.broadcastStatus || {};
              setBroadcastStatus({
                pending: bs.pending ?? 0,
                accepted: bs.accepted ?? 0,
                rejected: bs.rejected ?? 0,
                currentRadius: bs.currentRadius ?? orderData.currentRadius ?? 5,
              });
              if (Array.isArray(broadcastRes.broadcasts)) {
                setBroadcastList(broadcastRes.broadcasts.map((b: any) => ({
                  id: b.id,
                  pharmacyId: b.pharmacyId ?? b.pharmacy_id,
                  pharmacyName: b.pharmacyName ?? b.pharmacy_name,
                  latitude: b.latitude ?? null,
                  longitude: b.longitude ?? null,
                  status: b.status,
                  distance_from_customer: b.distance_from_customer ?? b.distanceFromCustomer,
                  distanceFromCustomer: b.distanceFromCustomer ?? b.distance_from_customer,
                })));
              }
            }
          } catch (broadcastErr) {
            // Fallback broadcast status from order data
            setBroadcastStatus({
              pending: 0,
              accepted: 0,
              rejected: 0,
              currentRadius: orderData.currentRadius ?? 5,
            });
          }
        }
        
        // Stop polling if order is in final state
        if (['delivered', 'cancelled', 'rejected'].includes(orderData.status)) {
          setPolling(false);
        }
      }
    } catch (error) {
      console.error('Error loading order status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const copyOTP = () => {
    if (order?.deliveryOtp) {
      navigator.clipboard.writeText(order.deliveryOtp);
      setCopiedOTP(true);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopiedOTP(false), 2000);
    }
  };
  
  // Check if order is out for delivery (should show OTP)
  const isOutForDelivery = order && ['dispatched', 'in_transit', 'out_for_delivery', 'arriving'].includes(order.status);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'broadcasting':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'accepted':
      case 'invoice_generated':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'payment_confirmed':
      case 'preparing':
      case 'ready':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'dispatched':
      case 'in_transit':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'delivered':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'broadcasting':
        return <AlertCircle className="w-5 h-5" />;
      case 'accepted':
      case 'invoice_generated':
        return <FileText className="w-5 h-5" />;
      case 'payment_confirmed':
      case 'preparing':
      case 'ready':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'dispatched':
      case 'in_transit':
        return <Truck className="w-5 h-5" />;
      case 'delivered':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getStatusMessage = (status: OrderStatus) => {
    switch (status) {
      case 'broadcasting':
        return 'Finding nearby pharmacy...';
      case 'accepted':
        return 'Pharmacy accepted your order';
      case 'invoice_generated':
        return 'Invoice ready — complete payment in the order flow';
      case 'payment_confirmed':
        return 'Payment received — preparing your order';
      case 'rejected':
        return 'No pharmacy available. Please try again.';
      case 'preparing':
        return 'Pharmacy is preparing your order';
      case 'ready':
        return 'Order is ready for pickup';
      case 'dispatched':
        return 'Order has been dispatched';
      case 'in_transit':
      case 'out_for_delivery':
        return 'Order is on the way';
      case 'arriving':
        return 'Delivery partner is arriving';
      case 'delivered':
        return 'Order delivered successfully';
      case 'cancelled':
        return 'Order was cancelled';
      default:
        return 'Processing your order';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-sm text-gray-500 mb-4">Unable to load order status</p>
          {onBack && (
            <Button onClick={onBack} className="bg-orange-500 hover:bg-orange-600">
              Go Back
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 pt-8 pb-6">
        {onBack && (
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/90 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        )}
        <h1 className="text-2xl font-bold mb-2">Order Status</h1>
        <p className="text-white/80 text-sm">Order ID: {orderId.slice(0, 8)}</p>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Status Card */}
        <Card className={`p-6 border-2 ${getStatusColor(order.status)}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              {getStatusIcon(order.status)}
            </div>
            <div className="flex-1">
              <Badge className={`${getStatusColor(order.status)} mb-2`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <h3 className="font-bold text-lg">{getStatusMessage(order.status)}</h3>
            </div>
          </div>

          {order.status === 'broadcasting' && (
            <div className="text-center">
              <p className="text-sm text-blue-700 mb-2">
                We're finding the nearest pharmacy that has all your medicines in stock.
              </p>
            </div>
          )}

          {order.estimatedTime && order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div className="bg-white/50 rounded-xl p-3 mt-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Estimated time: {order.estimatedTime} {order.estimatedTime === 1 ? 'minute' : 'minutes'}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Broadcast Map - Show when searching for pharmacies */}
        {order.status === 'broadcasting' && (
          <PharmacyBroadcastMap
            currentRadius={order.currentRadius || broadcastStatus?.currentRadius || 5}
            pharmaciesNotified={broadcastStatus ? (broadcastStatus.pending + broadcastStatus.accepted + broadcastStatus.rejected) : 0}
            pharmaciesAccepted={broadcastStatus?.accepted || 0}
            pharmaciesPending={broadcastStatus?.pending || 0}
            pharmaciesRejected={broadcastStatus?.rejected || 0}
            isSearching={true}
            customerLocation={order.deliveryAddress ? {
              lat: order.deliveryAddress.latitude ?? order.deliveryAddress.lat,
              lng: order.deliveryAddress.longitude ?? order.deliveryAddress.lng
            } : undefined}
            pharmacies={broadcastList}
          />
        )}

        {/* Pharmacy Info - Show when accepted */}
        {order.status !== 'broadcasting' && order.status !== 'rejected' && order.pharmacyName && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              Pharmacy Details
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Pharmacy Name</p>
                <p className="font-semibold text-gray-900">{order.pharmacyName}</p>
              </div>
              {order.pharmacyAddress && (
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Address
                  </p>
                  <p className="font-medium text-gray-900">{order.pharmacyAddress}</p>
                </div>
              )}
              {order.pharmacyPhone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = `tel:${order.pharmacyPhone}`}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call Pharmacy
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* ✅ Delivery OTP Section - Show when order is out for delivery */}
        {isOutForDelivery && order.deliveryOtp && !order.otpVerified && (
          <Card className="p-5 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Key className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-800 text-lg">Your Delivery OTP</h3>
            </div>
            
            {/* Large OTP Display */}
            <div className="flex justify-center gap-3 mb-4">
              {order.deliveryOtp.split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-14 h-16 bg-white rounded-xl shadow-sm border-2 border-orange-300 flex items-center justify-center"
                >
                  <span className="text-3xl font-bold text-orange-600">
                    {showOTP ? digit : '•'}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Toggle & Copy Buttons */}
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOTP(!showOTP)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {showOTP ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide OTP
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show OTP
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyOTP}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {copiedOTP ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy OTP
                  </>
                )}
              </Button>
            </div>
            
            {/* Instructions */}
            <div className="mt-4 text-center">
              <p className="text-orange-700 text-sm font-medium">
                Share this OTP with the delivery partner to confirm delivery
              </p>
              <p className="text-orange-600 text-xs mt-1">
                Only share after receiving your medicines
              </p>
            </div>
            
            {/* Delivery Partner Info */}
            {order.deliveryPartnerName && (
              <div className="mt-4 pt-4 border-t border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">{order.deliveryPartnerName}</span>
                  </div>
                  {order.deliveryPartnerPhone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `tel:${order.deliveryPartnerPhone}`}
                      className="border-orange-300 text-orange-700"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Open in Google Maps - delivery tracking */}
            {order.deliveryAddress && (order.deliveryAddress.latitude != null || order.deliveryAddress.lat != null) && (
              <div className="mt-4 pt-4 border-t border-orange-200">
                <Button
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => {
                    const lat = order.deliveryAddress?.latitude ?? order.deliveryAddress?.lat;
                    const lng = order.deliveryAddress?.longitude ?? order.deliveryAddress?.lng;
                    if (lat != null && lng != null) {
                      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                    } else {
                      const addr = [order.deliveryAddress?.addressLine1, order.deliveryAddress?.city, order.deliveryAddress?.pincode].filter(Boolean).join(', ');
                      if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                    }
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Track on Google Maps
                </Button>
              </div>
            )}
          </Card>
        )}
        
        {/* OTP Verified Badge */}
        {order.otpVerified && order.status === 'delivered' && (
          <Card className="p-5 bg-green-50 border-2 border-green-200">
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-bold text-green-800">Delivery Confirmed!</h3>
                <p className="text-sm text-green-600">Your order has been delivered successfully</p>
              </div>
            </div>
          </Card>
        )}

        {/* Proforma Invoice - Show when accepted */}
        {order.proformaInvoice && order.status === 'accepted' && (
          <Card className="p-5 border-2 border-green-200">
            <h3 className="font-semibold text-gray-900 mb-4">Proforma Invoice</h3>
            <div className="space-y-2 mb-4">
              {order.proformaInvoice.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.name} x{item.quantity}</span>
                  <span className="font-medium">₹{item.price}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{order.proformaInvoice.total}</span>
              </div>
            </div>
            <Button
              onClick={onViewInvoice}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Review & Confirm
            </Button>
          </Card>
        )}

        {/* Order Items */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
          <div className="space-y-3">
            {order.medicines.map((medicine, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{medicine.name}</p>
                  <p className="text-sm text-gray-500">Qty: {medicine.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">₹{medicine.price}</p>
                  {!medicine.available && (
                    <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                      Out of Stock
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 flex justify-between font-bold">
              <span>Total Amount</span>
              <span>₹{order.totalAmount}</span>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        {order.status === 'rejected' && (
          <Button
            onClick={onBack}
            className="w-full bg-orange-500 hover:bg-orange-600"
          >
            Place New Order
          </Button>
        )}
      </div>
    </div>
  );
}
