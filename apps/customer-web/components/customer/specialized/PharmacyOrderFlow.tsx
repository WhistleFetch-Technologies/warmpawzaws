'use client';

/**
 * ============================================================================
 * PHARMACY ORDER FLOW COMPONENT
 * ============================================================================
 * 
 * Complete flow for ordering medicines with prescription
 * - Upload prescription or select from booking
 * - Real-time broadcast status with radius expansion
 * - Pharmacy acceptance & invoice approval
 * - Payment & delivery tracking
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, FileText, MapPin, Clock, Check, 
  CheckCircle2, Loader2, AlertCircle, Package, Truck,
  Phone, MessageSquare, Star, Building2, ChevronRight,
  X, Camera, Image, RefreshCw, Circle, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';

interface PharmacyOrderFlowProps {
  customerPhone: string;
  customerId: string;
  prescriptionId?: string; // If ordering from a booking prescription
  prescriptionUrl?: string;
  defaultAddress?: {
    id?: string;
    label: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
  onBack: () => void;
  onComplete: (orderId: string) => void;
}

type OrderStep = 'prescription' | 'address' | 'broadcasting' | 'accepted' | 'invoice' | 'payment' | 'tracking' | 'completed';

interface BroadcastStatus {
  status: 'broadcasting' | 'accepted' | 'expired';
  currentRadius: 5 | 10 | 20;
  notifiedPharmaciesCount: number;
  startedAt: string;
  expiresAt: string;
}

interface AcceptedPharmacy {
  id: string;
  name: string;
  phone: string;
  rating?: number;
  distance?: number;
  acceptedAt: string;
}

interface Invoice {
  id: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    available: boolean;
  }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  deliveryCharges: number;
  platformFee: number;
  convenienceFee: number;
  totalAmount: number;
}

export function PharmacyOrderFlow({
  customerPhone,
  customerId,
  prescriptionId: initialPrescriptionId,
  prescriptionUrl: initialPrescriptionUrl,
  defaultAddress,
  onBack,
  onComplete,
}: PharmacyOrderFlowProps) {
  // State
  const [step, setStep] = useState<OrderStep>(initialPrescriptionId ? 'address' : 'prescription');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // Prescription
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(initialPrescriptionUrl || null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(initialPrescriptionId || null);
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  
  // Address
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(defaultAddress || null);
  
  // Broadcast
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus | null>(null);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  
  // Pharmacy & Invoice
  const [acceptedPharmacy, setAcceptedPharmacy] = useState<AcceptedPharmacy | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  
  // Notes
  const [notes, setNotes] = useState('');
  
  // WebSocket for real-time updates
  const { subscribeToOrder, subscribeToPharmacyBroadcast } = useWebSocket(customerId, 'customer');

  useEffect(() => {
    loadAddresses();
  }, []);

  // ============================================================================
  // LOAD DATA
  // ============================================================================

  const loadAddresses = async () => {
    try {
      const res = await apiClient.get<any>(`/customer/${customerPhone}/addresses`);
      const addressList = res.addresses || [];
      setAddresses(addressList);
      
      if (!selectedAddress && addressList.length > 0) {
        const defaultAddr = addressList.find((a: any) => a.isDefault) || addressList[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  // ============================================================================
  // PRESCRIPTION UPLOAD
  // ============================================================================

  const handlePrescriptionUpload = async (file: File) => {
    setUploadingPrescription(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customerId', customerId);
      formData.append('documentType', 'prescription');
      
      const res = await apiClient.upload<any>('/storage/upload', formData);
      
      if (res.url) {
        setPrescriptionUrl(res.url);
        toast.success('Prescription uploaded successfully!');
      }
    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      toast.error(error.message || 'Failed to upload prescription');
    } finally {
      setUploadingPrescription(false);
    }
  };

  // ============================================================================
  // CREATE ORDER & START BROADCAST
  // ============================================================================

  const createOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    if (!prescriptionUrl && !prescriptionId) {
      toast.error('Please upload a prescription');
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.post<any>('/pharmacy/orders/create', {
        customerId,
        customerPhone,
        prescriptionId,
        prescriptionUrl,
        deliveryAddress: {
          addressLine1: selectedAddress.addressLine1 || selectedAddress.address,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude,
        },
        notes,
      });

      if (res.success && res.orderId) {
        setOrderId(res.orderId);
        setBroadcastStatus(res.broadcast);
        setStep('broadcasting');
        
        // Start polling for broadcast status
        startBroadcastPolling(res.orderId);
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // BROADCAST POLLING
  // ============================================================================

  const startBroadcastPolling = (orderIdToTrack: string) => {
    // Use WebSocket for real-time updates instead of polling
    const unsubscribe = subscribeToOrder(orderIdToTrack, (data) => {
      if (data.status === 'accepted' && data.pharmacy) {
        setAcceptedPharmacy(data.pharmacy);
        setStep('accepted');
        toast.success(`${data.pharmacy.name} accepted your order!`);
        unsubscribe();
      } else if (data.status === 'invoice_sent' && data.invoice) {
        setInvoice(data.invoice);
        setStep('invoice');
        unsubscribe();
      } else if (data.status === 'expired') {
        setStep('prescription');
        toast.error('No pharmacy available. Please try again later.');
        unsubscribe();
      } else if (data.broadcast) {
        setBroadcastStatus(data.broadcast);
        // Update progress
        const elapsed = Date.now() - new Date(data.broadcast.startedAt).getTime();
        const maxDuration = 6 * 60 * 1000;
        setBroadcastProgress(Math.min((elapsed / maxDuration) * 100, 100));
      }
    });

    // Fallback: Still poll if WebSocket not available (for compatibility)
    const pollInterval = setInterval(async () => {
      try {
        const res = await apiClient.get<any>(`/pharmacy/orders/${orderIdToTrack}/status`);
        if (res.success && res.status !== 'broadcasting') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling:', error);
      }
    }, 10000); // Poll every 10 seconds as fallback

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  };

  // ============================================================================
  // INVOICE APPROVAL & PAYMENT
  // ============================================================================

  const approveInvoiceAndPay = async () => {
    if (!orderId || !invoice) return;

    setLoading(true);

    try {
      // Initiate payment
      const paymentRes = await apiClient.post<any>('/razorpay/create-order', {
        orderId,
        amount: invoice.totalAmount,
        customerId,
        type: 'pharmacy_order',
      });

      if (!paymentRes.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: invoice.totalAmount * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: 'Medicine Order',
        order_id: paymentRes.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            await apiClient.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success('Payment successful!');
            setStep('tracking');
          } catch (err) {
            console.error('Payment verification failed:', err);
            toast.error('Payment verification failed');
          }
          setLoading(false);
        },
        prefill: {
          contact: customerPhone,
        },
        theme: {
          color: '#FF8C42',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      if ((window as any).Razorpay) {
        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Payment failed');
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const getRadiusLabel = (radius: number) => {
    switch (radius) {
      case 5: return '5 km radius';
      case 10: return '10 km radius';
      case 20: return '20 km radius';
      default: return `${radius} km radius`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {['Prescription', 'Address', 'Finding Pharmacy', 'Pay'].map((label, idx) => {
            const steps: OrderStep[] = ['prescription', 'address', 'broadcasting', 'payment'];
            const currentIdx = steps.indexOf(step);
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            
            return (
              <div key={label} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-[#FF8C42] text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                {idx < 3 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Step 1: Prescription Upload */}
        {step === 'prescription' && (
          <>
            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF8C42]" />
                Upload Prescription
              </h2>
              
              {prescriptionUrl ? (
                <div className="relative">
                  <img 
                    src={prescriptionUrl} 
                    alt="Prescription" 
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <button
                    onClick={() => setPrescriptionUrl(null)}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#FF8C42] transition">
                    {uploadingPrescription ? (
                      <Loader2 className="w-10 h-10 mx-auto text-[#FF8C42] animate-spin mb-3" />
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Camera className="w-8 h-8 text-[#FF8C42]" />
                        </div>
                        <p className="text-gray-900 font-medium mb-1">
                          Take photo or upload
                        </p>
                        <p className="text-gray-500 text-sm">
                          JPG, PNG up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePrescriptionUpload(file);
                    }}
                  />
                </label>
              )}
            </Card>

            <Card className="bg-blue-50 border-blue-200 rounded-2xl p-4">
              <p className="text-blue-800 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Make sure the prescription is clear and includes the doctor's signature and date.
              </p>
            </Card>

            <Button
              onClick={() => setStep('address')}
              disabled={!prescriptionUrl && !prescriptionId}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] py-6 text-lg"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </>
        )}

        {/* Step 2: Address Selection */}
        {step === 'address' && (
          <>
            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                Delivery Address
              </h2>
              
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      selectedAddress?.id === addr.id
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{addr.label || 'Home'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {addr.addressLine1 || addr.address}, {addr.city} - {addr.pincode}
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Add Note (Optional)</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions for the pharmacy..."
                className="w-full h-20 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
              />
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep('prescription')}
                variant="outline"
                className="flex-1 py-6"
              >
                Back
              </Button>
              <Button
                onClick={createOrder}
                disabled={!selectedAddress || loading}
                className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35] py-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Find Pharmacy</>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Broadcasting */}
        {step === 'broadcasting' && broadcastStatus && (
          <>
            <Card className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white rounded-2xl p-6 border-0">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <Building2 className="w-10 h-10" />
                  <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
                </div>
                <h2 className="text-xl font-bold mb-2">Finding Nearby Pharmacies</h2>
                <p className="text-white/80">
                  Currently searching within {getRadiusLabel(broadcastStatus.currentRadius)}
                </p>
              </div>

              {/* Progress */}
              <div className="bg-white/20 rounded-full h-2 mb-4 overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-1000"
                  style={{ width: `${broadcastProgress}%` }}
                />
              </div>

              {/* Radius indicators */}
              <div className="flex justify-between text-sm">
                {[5, 10, 20].map((r) => (
                  <div 
                    key={r}
                    className={`flex items-center gap-1 ${
                      broadcastStatus.currentRadius >= r ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    <Circle className={`w-3 h-3 ${
                      broadcastStatus.currentRadius >= r ? 'fill-white' : ''
                    }`} />
                    {r}km
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Pharmacies notified</span>
                <span className="font-bold text-[#FF8C42]">
                  {broadcastStatus.notifiedPharmaciesCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Time remaining</span>
                <span className="font-medium text-gray-900">
                  <Clock className="w-4 h-4 inline mr-1" />
                  {Math.max(0, Math.ceil((new Date(broadcastStatus.expiresAt).getTime() - Date.now()) / 60000))} min
                </span>
              </div>
            </Card>

            <p className="text-center text-gray-500 text-sm">
              Please wait while we find the best pharmacy for your order. 
              You'll be notified once a pharmacy accepts.
            </p>
          </>
        )}

        {/* Step 4: Pharmacy Accepted */}
        {step === 'accepted' && acceptedPharmacy && (
          <>
            <Card className="bg-green-50 border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-green-900">Order Accepted!</h2>
                  <p className="text-green-700 text-sm">Preparing your invoice...</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-[#FF8C42]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{acceptedPharmacy.name}</h3>
                  {acceptedPharmacy.distance && (
                    <p className="text-sm text-gray-500">
                      {acceptedPharmacy.distance.toFixed(1)} km away
                    </p>
                  )}
                  {acceptedPharmacy.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{acceptedPharmacy.rating}</span>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = `tel:${acceptedPharmacy.phone}`}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Waiting for invoice...</span>
            </div>
          </>
        )}

        {/* Step 5: Invoice */}
        {step === 'invoice' && invoice && (
          <>
            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-4">Invoice</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div className="flex-1">
                      <p className={`font-medium ${!item.available ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-gray-900">₹{item.price}</p>
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{invoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">GST</span>
                  <span>₹{invoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Charges</span>
                  <span>₹{invoice.deliveryCharges.toFixed(2)}</span>
                </div>
                {invoice.platformFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee</span>
                    <span>₹{invoice.platformFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-[#FF8C42]">₹{invoice.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </Card>

            <Button
              onClick={approveInvoiceAndPay}
              disabled={loading}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] py-6 text-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay ₹{invoice.totalAmount.toFixed(2)}
                </>
              )}
            </Button>
          </>
        )}

        {/* Step 6: Tracking */}
        {step === 'tracking' && (
          <>
            <Card className="bg-green-50 border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <h2 className="font-bold text-green-900">Payment Successful!</h2>
                  <p className="text-green-700 text-sm">Your order is being prepared</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="space-y-4">
                {[
                  { label: 'Order Placed', done: true },
                  { label: 'Preparing Medicines', done: true },
                  { label: 'Ready for Pickup', done: false },
                  { label: 'Out for Delivery', done: false },
                  { label: 'Delivered', done: false },
                ].map((status, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {status.done ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span className="text-xs">{idx + 1}</span>
                      )}
                    </div>
                    <span className={status.done ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                      {status.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Button
              onClick={() => onComplete(orderId!)}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35]"
            >
              Track Order
              <Truck className="w-5 h-5 ml-2" />
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

export default PharmacyOrderFlow;
