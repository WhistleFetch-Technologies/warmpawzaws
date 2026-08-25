'use client';

/**
 * ============================================================================
 * PHARMACY ORDER FLOW - Complete End-to-End Medicine Ordering
 * ============================================================================
 * 
 * Features:
 * - Medicine item selection/entry
 * - Delivery address selection (Uber-like)
 * - Pharmacy broadcasting (5km → 10km → 20km)
 * - Real-time tracking with Google Maps
 * - Payment integration
 * - OTP verification
 * 
 * Design: Matches Home Services flow
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pill, MapPin, Clock, Package, Truck, CheckCircle2,
  Plus, Minus, Trash2, Search, Navigation, Phone, Building2,
  CreditCard, Wallet, AlertCircle, Loader2, RefreshCw, Car, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import {
  fillAddressFromCurrentLocation,
  geolocationErrorMessage,
  resolveCurrentGeolocationCoords,
} from '@/lib/address-from-geolocation';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';
import { toast } from 'sonner';
import { PharmacyOrderStatus } from './PharmacyOrderStatus';
import { PharmacyBroadcastMap } from './PharmacyBroadcastMap';
import { PharmacyOrderAcceptance } from './PharmacyOrderAcceptance';
import { PharmacyDeliveryTracker } from './PharmacyDeliveryTracker';
import { trackBookingStep } from '@/lib/analytics';

interface MedicineItem {
  medicine_name: string;
  quantity: number;
  unit_price: number;
}

interface DeliveryAddress {
  address: string;
  lat: number;
  lng: number;
  landmark?: string;
  pincode?: string;
}

type FlowStep = 'items' | 'address' | 'broadcasting' | 'invoice_approval' | 'payment' | 'tracking';

interface PharmacyOrderFlowProps {
  customerId: string;
  phone: string;
  prescriptionId?: string;
  initialItems?: MedicineItem[];
  onBack?: () => void;
  onOrderPlaced?: (orderId: string) => void;
}

export function PharmacyOrderFlow({
  customerId,
  phone,
  prescriptionId,
  initialItems = [],
  onBack,
  onOrderPlaced
}: PharmacyOrderFlowProps) {
  const [step, setStep] = useState<FlowStep>('items');
  const [items, setItems] = useState<MedicineItem[]>(initialItems);
  const [newItem, setNewItem] = useState({ medicine_name: '', quantity: 1, unit_price: 0 });
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [logisticsType, setLogisticsType] = useState<'own' | 'warmpawz' | 'shiprocket'>('warmpawz');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [broadcastStatus, setBroadcastStatus] = useState<any>(null);
  const [searchingPharmacies, setSearchingPharmacies] = useState(false);
  const [invoice, setInvoice] = useState<any>(null); // Proforma invoice from pharmacy
  const [invoiceApproved, setInvoiceApproved] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<{
    subtotal: number;
    deliveryFee: number;
    platformFee: number;
    convenienceFee: number;
    total: number;
  } | null>(null);

  // Accepted pharmacy info for enhanced UI
  const [acceptedPharmacy, setAcceptedPharmacy] = useState<{
    id: string;
    name: string;
    address: string;
    phone?: string;
    distance: number;
    rating?: number;
  } | null>(null);

  // Medicine availability status
  const [medicineAvailability, setMedicineAvailability] = useState<Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    available: boolean;
    substituteAvailable?: boolean;
    substituteName?: string;
    substitutePrice?: number;
  }>>([]);

  // Delivery tracking state
  const [deliveryStatus, setDeliveryStatus] = useState<{
    status: 'preparing' | 'ready' | 'picked_up' | 'on_the_way' | 'arriving' | 'delivered';
    history: Array<{ status: string; timestamp: string; message?: string }>;
    eta?: { minutes: number; time: string };
    deliveryPartner?: {
      name: string;
      phone: string;
      vehicleNumber?: string;
      vehicleType?: 'bike' | 'car';
    };
    liveLocation?: { lat: number; lng: number; lastUpdated: string };
    deliveryOtp?: string;
    otpVerified?: boolean;
  } | null>(null);

  // ✅ ANALYTICS: Track flow steps
  useEffect(() => {
    const stepToAnalyticsMap: Record<FlowStep, string> = {
      'items': 'service_selection',
      'address': 'address_selection',
      'broadcasting': 'provider_discovery',
      'invoice_approval': 'provider_selection',
      'payment': 'payment_initiated',
      'tracking': 'booking_confirmed',
    };
    
    const analyticsStep = stepToAnalyticsMap[step];
    if (analyticsStep) {
      trackBookingStep({
        step: analyticsStep as any,
        serviceCategory: 'pharmacy',
        serviceStyle: 'at_home',
        phone,
        metadata: {
          itemsCount: items.length,
          orderId,
        }
      });
    }
  }, [step, items.length, orderId]);

  // Load saved address if available
  useEffect(() => {
    void resolveCurrentGeolocationCoords()
      .then((coords) => {
        setAddress({
          address: 'Current Location',
          lat: coords.latitude,
          lng: coords.longitude,
        });
      })
      .catch(() => {
        // Silent fail — user can enter address manually
      });
  }, []);

  const handleAddItem = () => {
    if (!newItem.medicine_name || newItem.unit_price <= 0) {
      toast.error('Please enter medicine name and price');
      return;
    }
    setItems([...items, { ...newItem }]);
    setNewItem({ medicine_name: '', quantity: 1, unit_price: 0 });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    setItems(updated);
  };

  const handleDetectLocation = async () => {
    setLoading(true);
    try {
      const result = await fillAddressFromCurrentLocation();
      const addr = result.addressLine1 || 'Current Location';
      setAddressInput(addr);
      setAddress({
        address: addr,
        lat: result.latitude,
        lng: result.longitude,
      });
      toast.success('Location detected!');
    } catch (error) {
      toast.error(geolocationErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }
    if (!address || !address.lat || !address.lng) {
      toast.error('Please select delivery address');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<any>('/pharmacy/orders/create', {
        customerId,
        prescriptionId: prescriptionId || null,
        items,
        deliveryAddress: {
          ...address,
          landmark,
          pincode,
        },
        paymentMethod,
        logisticsType,
      });

      if (response?.success && response?.order) {
        const newOrderId = response.order.id;
        setOrderId(newOrderId);
        setStep('broadcasting');
        setSearchingPharmacies(true);
        
        // Start polling for broadcast status
        pollBroadcastStatus(newOrderId);
        
        if (onOrderPlaced) {
          onOrderPlaced(newOrderId);
        }
      } else {
        toast.error((response as any)?.error || 'Failed to create order');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const pollBroadcastStatus = async (orderId: string) => {
    let lastRadius = 5; // Start with 5km
    let lastExpandTime = Date.now();
    const EXPAND_INTERVAL = 2 * 60 * 1000; // 2 minutes

    const interval = setInterval(async () => {
      try {
        const response = await apiClient.get<any>(`/pharmacy/orders/${orderId}/broadcast-status`);
        if (response?.success && response?.broadcastStatus) {
          const status = response.broadcastStatus;
          setBroadcastStatus(status);
          
          // Update current radius
          if (status.currentRadius) {
            lastRadius = status.currentRadius;
          }
          
          // Check if pharmacy accepted
          if (status.accepted > 0) {
            clearInterval(interval);
            setSearchingPharmacies(false);
            
            // Store accepted pharmacy info
            if (status.acceptedPharmacy) {
              setAcceptedPharmacy({
                id: status.acceptedPharmacy.id,
                name: status.acceptedPharmacy.name || status.acceptedPharmacy.businessName,
                address: status.acceptedPharmacy.address || '',
                phone: status.acceptedPharmacy.phone,
                distance: status.acceptedPharmacy.distance || 0,
                rating: status.acceptedPharmacy.rating
              });
            }
            
            // Pharmacy accepted - wait for invoice
            setStep('invoice_approval');
            toast.success('Pharmacy found! Waiting for invoice...');
            // Start polling for invoice
            pollInvoiceStatus(orderId);
            return;
          }
          
          // ✅ Auto-expand radius every 2 minutes: 5km → 10km → 20km
          const timeSinceLastExpand = Date.now() - lastExpandTime;
          if (timeSinceLastExpand >= EXPAND_INTERVAL && lastRadius < 20) {
            try {
              const expandResponse = await apiClient.post<any>(`/pharmacy/orders/${orderId}/expand-broadcast`);
              if (expandResponse?.success) {
                lastRadius = expandResponse.newRadius || lastRadius + 5;
                lastExpandTime = Date.now();
                toast.info(`Searching expanded to ${lastRadius}km radius`);
              }
            } catch (e) {
              console.warn('Could not expand broadcast:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error polling broadcast status:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 6 minutes (allows for 3 expansions: 5km, 10km, 20km)
    setTimeout(() => {
      clearInterval(interval);
      if (step === 'broadcasting') {
        setSearchingPharmacies(false);
        toast.error('No pharmacy found. Please try again later.');
      }
    }, 6 * 60 * 1000); // 6 minutes total
  };

  // Poll for invoice status after pharmacy accepts
  const pollInvoiceStatus = async (orderId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiClient.get<any>(`/pharmacy/orders/${orderId}`);
        if (response?.success && response?.order) {
          const order = response.order;
          
          // Check if invoice is uploaded
          if (order.invoice_url || order.perfora_invoice_url || order.invoice_amount) {
            clearInterval(interval);
            
            // Calculate fee breakdown
            const subtotal = order.invoice_amount || order.subtotal || 0;
            const deliveryFee = order.delivery_fee || 0;
            const platformFee = order.platform_fee || 0;
            const convenienceFee = order.convenience_fee || 0;
            const total = subtotal + deliveryFee + platformFee + convenienceFee;
            
            setInvoice({
              url: order.invoice_url || order.perfora_invoice_url,
              amount: order.invoice_amount || subtotal,
              items: order.invoice_items || order.items
            });
            
            setFeeBreakdown({
              subtotal,
              deliveryFee,
              platformFee,
              convenienceFee,
              total
            });
            
            toast.success('Invoice received! Please review and approve.');
          }
        }
      } catch (error) {
        console.error('Error polling invoice status:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
    }, 10 * 60 * 1000);
  };

  // Handle online payment via Razorpay
  const handleOnlinePayment = async () => {
    if (!orderId || !feeBreakdown) {
      toast.error('Order details not available');
      return;
    }

    setLoading(true);
    try {
      // Create Razorpay order
      const response = await apiClient.post<any>('/payments/create-order', {
        orderId,
        amount: feeBreakdown.total,
        type: 'pharmacy'
      });

      if (response?.success && response?.razorpayOrderId) {
        // Load Razorpay script if not already loaded
        if (typeof (window as any).Razorpay === 'undefined') {
          await loadRazorpayScript();
        }

        const checkoutEmail = await fetchCheckoutEmailForPrefill(phone);
        await openStandardRazorpayCheckout({
          key: (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
            process.env.NEXT_PUBLIC_RAZORPAY_KEY) as string,
          amountPaise: Math.max(1, Math.round(feeBreakdown.total * 100)),
          currency: 'INR',
          name: 'Warmpawz',
          description: `Medicine Order - ${orderId.slice(0, 8)}`,
          order_id: response.razorpayOrderId,
          customerPhone: phone,
          customerEmail: checkoutEmail,
          handler: async function (razorpayResponse: any) {
            // Verify payment
            try {
              const verifyResponse = await apiClient.post<any>('/payments/verify', {
                orderId,
                razorpayOrderId: razorpayResponse.razorpay_order_id,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpaySignature: razorpayResponse.razorpay_signature
              });

              if (verifyResponse?.success) {
                toast.success('Payment successful!');
                setStep('tracking');
              } else {
                toast.error('Payment verification failed');
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              toast.error('Payment verification failed');
            }
          },
          theme: {
            color: '#F97316'
          },
          onPaymentFailed: (err) => {
            toast.error(err.message);
          },
        });
      } else {
        toast.error('Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // Load Razorpay script dynamically
  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

  // Handle Cash on Delivery confirmation
  const handleCODConfirmation = async () => {
    if (!orderId) {
      toast.error('Order ID not available');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<any>(`/pharmacy/orders/${orderId}/confirm-cod`, {
        paymentMethod: 'cod'
      });

      if (response?.success) {
        toast.success('Order confirmed! Cash on delivery selected.');
        setStep('tracking');
      } else {
        toast.error(response?.error || 'Failed to confirm order');
      }
    } catch (error: any) {
      console.error('COD confirmation error:', error);
      toast.error(error.message || 'Failed to confirm order');
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'items':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Medicines</h2>
              <p className="text-gray-600">Enter the medicines you need</p>
            </div>

            {/* Add Medicine Form */}
            <Card className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                  <Input
                    value={newItem.medicine_name}
                    onChange={(e) => setNewItem({ ...newItem, medicine_name: e.target.value })}
                    placeholder="e.g., Paracetamol 500mg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddItem} className="w-full bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medicine
                </Button>
              </div>
            </Card>

            {/* Medicine List */}
            {items.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Added Medicines</h3>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.medicine_name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity} × ₹{item.unit_price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(index, -1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="font-semibold w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(index, 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}</span>
                </div>
              </Card>
            )}

            <Button
              onClick={() => setStep('address')}
              disabled={items.length === 0}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              Continue to Address
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Address</h2>
              <p className="text-gray-600">Where should we deliver your medicines?</p>
            </div>

            <Card className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <div className="flex gap-2">
                    <Input
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      placeholder="Enter delivery address"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleDetectLocation}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landmark (Optional)</label>
                  <Input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g., Near Metro Station"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <Input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="400001"
                    maxLength={6}
                  />
                </div>
                {address && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 text-green-700">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm font-medium">Location: {address.lat.toFixed(4)}, {address.lng.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('items')}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep('payment')}
                disabled={!address || !addressInput}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                Continue to Payment
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment & Delivery</h2>
              <p className="text-gray-600">Choose payment method and logistics</p>
            </div>

            {/* Order Summary */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.medicine_name} × {item.quantity}</span>
                    <span className="font-medium">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {feeBreakdown ? (
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>₹{feeBreakdown.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span>₹{feeBreakdown.deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform Fee</span>
                    <span>₹{feeBreakdown.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Convenience</span>
                    <span>₹{feeBreakdown.convenienceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-orange-600">₹{feeBreakdown.total.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-gray-200 flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span>₹{items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}</span>
                </div>
              )}
            </Card>

            {/* Payment Method */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Method</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('online')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentMethod === 'online'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-semibold">Online Payment</p>
                      <p className="text-sm text-gray-500">Pay securely with Razorpay</p>
                    </div>
                    {paymentMethod === 'online' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-semibold">Cash on Delivery</p>
                      <p className="text-sm text-gray-500">Pay when you receive</p>
                    </div>
                    {paymentMethod === 'cod' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                  </div>
                </button>
              </div>
            </Card>

            {/* Logistics Type */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Delivery Partner</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setLogisticsType('warmpawz')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    logisticsType === 'warmpawz'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-semibold">Warmpawz Delivery</p>
                      <p className="text-sm text-gray-500">Fast and reliable</p>
                    </div>
                    {logisticsType === 'warmpawz' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                  </div>
                </button>
                <button
                  onClick={() => setLogisticsType('shiprocket')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    logisticsType === 'shiprocket'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-semibold">Shiprocket</p>
                      <p className="text-sm text-gray-500">Professional logistics</p>
                    </div>
                    {logisticsType === 'shiprocket' && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                  </div>
                </button>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('address')}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    Place Order
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 'broadcasting':
        return (
          <PharmacyBroadcastMap
            currentRadius={broadcastStatus?.currentRadius || 5}
            pharmaciesNotified={broadcastStatus?.totalBroadcasts || 0}
            pharmaciesAccepted={broadcastStatus?.accepted || 0}
            pharmaciesPending={broadcastStatus?.pending || 0}
            pharmaciesRejected={broadcastStatus?.rejected || 0}
            isSearching={searchingPharmacies}
            customerLocation={address ? { lat: address.lat, lng: address.lng } : undefined}
            acceptedPharmacy={broadcastStatus?.acceptedPharmacy ? {
              name: broadcastStatus.acceptedPharmacy.name,
              distance: broadcastStatus.acceptedPharmacy.distance || 0,
              address: broadcastStatus.acceptedPharmacy.address || ''
            } : undefined}
          />
        );

      case 'invoice_approval':
        // Determine the acceptance phase based on invoice status
        const acceptancePhase = !invoice 
          ? 'checking_availability' as const
          : invoiceApproved 
            ? 'approved' as const 
            : 'invoice_ready' as const;
        
        return (
          <PharmacyOrderAcceptance
            orderId={orderId || ''}
            pharmacy={{
              name: acceptedPharmacy?.name || 'Pharmacy',
              address: acceptedPharmacy?.address || '',
              phone: acceptedPharmacy?.phone,
              distance: acceptedPharmacy?.distance || 0,
              rating: acceptedPharmacy?.rating
            }}
            phase={acceptancePhase}
            medicines={medicineAvailability.length > 0 ? medicineAvailability : items.map(item => ({
              name: item.medicine_name,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              available: true
            }))}
            invoice={feeBreakdown ? {
              id: invoice?.id || orderId || '',
              subtotal: feeBreakdown.subtotal,
              deliveryFee: feeBreakdown.deliveryFee,
              platformFee: feeBreakdown.platformFee,
              convenienceFee: feeBreakdown.convenienceFee,
              total: feeBreakdown.total,
              items: medicineAvailability.length > 0 ? medicineAvailability : items.map(item => ({
                name: item.medicine_name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                available: true
              }))
            } : undefined}
            onApproveInvoice={() => {
              setInvoiceApproved(true);
              // Move to payment selection within the same component
            }}
            onPayNow={(method) => {
              setPaymentMethod(method);
              if (method === 'online') {
                // Handle online payment via Razorpay
                handleOnlinePayment();
              } else {
                // Handle COD - proceed to tracking
                handleCODConfirmation();
              }
            }}
            onCallPharmacy={() => {
              if (acceptedPharmacy?.phone) {
                window.location.href = `tel:${acceptedPharmacy.phone}`;
              }
            }}
            isLoading={loading}
          />
        );

      case 'tracking':
        if (orderId) {
          return (
            <PharmacyOrderStatus
              orderId={orderId}
              phone={phone}
              onBack={onBack}
            />
          );
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-orange-500 to-orange-600 pb-6 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        {step !== 'tracking' && (
          <button
            type="button"
            onClick={step === 'items' ? onBack : () => {
              if (step === 'address') setStep('items');
              else if (step === 'broadcasting') setStep('address');
              else if (step === 'invoice_approval') setStep('broadcasting');
              else if (step === 'payment') setStep('invoice_approval');
            }}
            className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Order Medicine</h1>
            <p className="text-white/80 text-sm">
              {step === 'items' && 'Add medicines'}
              {step === 'address' && 'Delivery address'}
              {step === 'broadcasting' && 'Finding pharmacy'}
              {step === 'invoice_approval' && 'Review invoice'}
              {step === 'payment' && 'Payment & delivery'}
              {step === 'tracking' && 'Track order'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      {step !== 'tracking' && (
        <div className="bg-white px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            {['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].filter(s => {
              // Show steps based on current progress
              const stepOrder = ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'];
              const currentIndex = stepOrder.indexOf(step);
              return stepOrder.indexOf(s) <= currentIndex + 1;
            }).map((s, index, filteredSteps) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === s
                      ? 'bg-orange-500 text-white'
                      : ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(step) > ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(s)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(step) > ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(s) ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(s) + 1
                  )}
                </div>
                {index < filteredSteps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(step) > ['items', 'address', 'broadcasting', 'invoice_approval', 'payment'].indexOf(s)
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
