'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, CreditCard, Wallet, Tag, ChevronRight, 
  CheckCircle2, Shield, X, Percent, Info, MapPin,
  Clock, Calendar, User, Plus, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { resolveGstDisplayRatePercent } from '@/lib/resolve-gst-display-rate';
import { toast } from 'sonner';

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentPageProps {
  // Booking details
  bookingId?: string;
  serviceId?: string;
  serviceName: string;
  serviceDescription?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'tele';
  vendorId: string;
  vendorName: string;
  
  // Schedule
  bookingDate?: string;
  bookingTime?: string;
  
  // Pet
  petId?: string;
  petName?: string;
  
  // Address (for home services)
  addressId?: string;
  address?: {
    label?: string;
    addressLine1?: string;
    city?: string;
    pincode?: string;
    state?: string;
  };
  
  // Pricing
  baseAmount: number;
  duration?: number;
  
  // Customer
  customerPhone: string;
  customerId?: string;
  
  // Navigation
  onBack: () => void;
  onSuccess: (bookingId: string, otpCode?: string) => void;
}

interface CouponResult {
  valid: boolean;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  message?: string;
}

interface WalletInfo {
  balance: number;
  currency: string;
}

interface SavedPaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking';
  last4?: string;
  brand?: string;
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
}

interface TaxBreakdown {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
  taxRate: number;
  isInterState: boolean;
}

function taxCalculateResponseHasPayload(res: any): boolean {
  if (!res || res.success !== true) return false;
  const err = res.error;
  if (typeof err === 'string' && err.trim()) return false;
  if (err != null && typeof err === 'object') return false;
  return Array.isArray(res.items) && res.items.length > 0;
}

export function PaymentPage({
  bookingId,
  serviceId,
  serviceName,
  serviceDescription,
  serviceStyle,
  vendorId,
  vendorName,
  bookingDate,
  bookingTime,
  petId,
  petName,
  addressId,
  address,
  baseAmount,
  duration,
  customerPhone,
  customerId,
  onBack,
  onSuccess,
}: PaymentPageProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('razorpay');
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  
  // Tax state
  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdown>({
    subtotal: baseAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    total: baseAmount,
    taxRate: 18,
    isInterState: false,
  });

  const applyDefaultGstBreakdown = useCallback(
    (ratePct: number) => {
      const totalTax = (baseAmount * ratePct) / 100;
      setTaxBreakdown({
        subtotal: baseAmount,
        cgst: totalTax / 2,
        sgst: totalTax / 2,
        igst: 0,
        totalTax,
        total: baseAmount + totalTax,
        taxRate: ratePct,
        isInterState: false,
      });
    },
    [baseAmount]
  );

  const calculateTax = useCallback(async () => {
    const addr = address;
    const customerLocation =
      addr?.state && String(addr.state).trim()
        ? {
            state: String(addr.state).trim(),
            city: addr.city,
            pincode: addr.pincode,
          }
        : undefined;

    try {
      const taxRes = await apiClient.post<any>('/tax/calculate', {
        items: [
          {
            id: serviceId || 'service',
            type: 'service',
            serviceId,
            amount: baseAmount,
            quantity: 1,
            category: 'pet_services',
            serviceStyle,
          },
        ],
        vendorId,
        customerId,
        customerPhone,
        customerLocation,
      });

      if (taxCalculateResponseHasPayload(taxRes)) {
        const cgst = taxRes.totalCGST || 0;
        const sgst = taxRes.totalSGST || 0;
        const igst = taxRes.totalIGST || 0;
        const totalTax = taxRes.totalTax ?? cgst + sgst + igst;
        const rawRate = Number(taxRes.items?.[0]?.taxRate);
        const declaredRate = Number.isFinite(rawRate) ? rawRate : 18;
        const taxRate = resolveGstDisplayRatePercent(
          baseAmount,
          totalTax,
          declaredRate,
          18
        );
        const interState =
          typeof taxRes.isInterState === 'boolean' ? taxRes.isInterState : igst > 0;

        setTaxBreakdown({
          subtotal: baseAmount,
          cgst,
          sgst,
          igst,
          totalTax,
          total: baseAmount + totalTax,
          taxRate,
          isInterState: interState,
        });
        return;
      }

      if (baseAmount > 0) {
        console.warn('Tax calculate returned no usable items; using default 18% split', taxRes);
        applyDefaultGstBreakdown(18);
      }
    } catch (error) {
      console.error('Tax calculation error, using default 18%:', error);
      if (baseAmount > 0) {
        applyDefaultGstBreakdown(18);
      }
    }
  }, [
    address,
    applyDefaultGstBreakdown,
    baseAmount,
    customerId,
    customerPhone,
    serviceId,
    serviceStyle,
    vendorId,
  ]);

  useEffect(() => {
    loadPaymentData();
    loadRazorpayScript();
    calculateTax();
  }, [customerPhone, baseAmount, calculateTax]);

  const loadRazorpayScript = () => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  };

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      
      // Load wallet balance
      try {
        const walletRes = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
        if (walletRes.wallet) {
          setWallet(walletRes.wallet);
        }
      } catch (e) {
        console.log('No wallet found');
      }
      
      // Load saved payment methods
      try {
        const methodsRes = await apiClient.get<any>(`/customer/payment-methods?phone=${encodeURIComponent(customerPhone)}`);
        if (methodsRes.methods) {
          setSavedMethods(methodsRes.methods);
          const defaultMethod = methodsRes.methods.find((m: SavedPaymentMethod) => m.isDefault);
          if (defaultMethod) {
            setSelectedMethod(defaultMethod.id);
          }
        }
      } catch (e) {
        console.log('No saved payment methods');
      }
      
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setCouponLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/coupons/validate/${couponCode.toUpperCase()}?amount=${taxBreakdown.total}`
      );
      
      if (res.valid) {
        setAppliedCoupon({
          valid: true,
          code: couponCode.toUpperCase(),
          discountType: res.coupon.discount_type,
          discountValue: res.coupon.discount_value,
          discountAmount: res.discountAmount,
          message: res.message,
        });
        toast.success(`Coupon applied! You save ₹${res.discountAmount}`);
        setShowCouponInput(false);
      } else {
        toast.error(res.error || 'Invalid coupon code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  // Calculate final amounts
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const walletAmount = useWallet && wallet ? Math.min(wallet.balance, taxBreakdown.total - couponDiscount) : 0;
  const finalAmount = Math.max(0, taxBreakdown.total - couponDiscount - walletAmount);

  const handlePayment = async () => {
    setProcessing(true);
    
    try {
      // Step 1: Create booking if not already created
      let currentBookingId = bookingId;
      
      if (!currentBookingId) {
        const bookingRes = await apiClient.post<any>('/bookings', {
          service_id: serviceId,
          vendor_id: vendorId,
          customer_phone: customerPhone,
          customer_id: customerId,
          pet_id: petId,
          address_id: addressId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          service_style: serviceStyle,
          total_amount: taxBreakdown.total,
          notes: '',
        });
        
        if (!bookingRes.booking_id && !bookingRes.id) {
          throw new Error('Failed to create booking');
        }
        currentBookingId = bookingRes.booking_id || bookingRes.id;
      }
      
      // Step 2: Create payment
      const paymentRes = await apiClient.post<any>('/payments/create', {
        bookingId: currentBookingId,
        amount: taxBreakdown.total,
        customerId,
        vendorId,
        paymentMethod: selectedMethod === 'razorpay' ? 'razorpay' : selectedMethod,
        useWallet,
        walletAmount,
        couponCode: appliedCoupon?.code,
        couponDiscount,
      });
      
      // If fully paid with wallet
      if (paymentRes.status === 'completed' || finalAmount === 0) {
        // Generate OTP for non-tele services
        const confirmedBookingId = currentBookingId || '';
        const otpCode = confirmedBookingId ? await generateBookingOTP(confirmedBookingId) : '';
        toast.success('Booking confirmed!');
        if (confirmedBookingId) {
          onSuccess(confirmedBookingId, otpCode);
        }
        return;
      }
      
      // Step 3: Create Razorpay order
      const orderRes = await apiClient.post<any>('/razorpay/create-order', {
        bookingId: currentBookingId,
        amount: finalAmount,
        customerId,
      });
      
      if (!orderRes.orderId) {
        throw new Error('Failed to create payment order');
      }
      
      // Step 4: Open Razorpay checkout
      const options = {
        key: orderRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: finalAmount * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: `${serviceName} - ${vendorName}`,
        order_id: orderRes.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment with retry
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                await apiClient.post('/razorpay/verify-payment', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }, undefined, 30000);
                break; // success
              } catch (verifyErr: any) {
                console.error(`[VERIFY] Attempt ${attempt}/${MAX_RETRIES} failed:`, verifyErr?.message);
                if (attempt === MAX_RETRIES) throw verifyErr;
                await new Promise((r) => setTimeout(r, attempt * 1000));
              }
            }
            
            // Apply coupon if used
            if (appliedCoupon) {
              await apiClient.post('/coupons/apply', {
                couponCode: appliedCoupon.code,
                bookingId: currentBookingId,
                customerId,
                amount: taxBreakdown.total,
              });
            }
            
            // Generate OTP for non-tele services
            const otpCode = await generateBookingOTP(currentBookingId!);
            
            toast.success('Payment successful!');
            onSuccess(currentBookingId!, otpCode);
          } catch (err) {
            console.error('Payment verification failed:', err);
            toast.error('Payment verification failed. Please contact support.');
            setProcessing(false);
          }
        },
        prefill: {
          contact: customerPhone,
        },
        theme: {
          color: '#FF8C42',
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };
      
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Payment gateway not loaded');
      }
      
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
      setProcessing(false);
    }
  };

  const generateBookingOTP = async (bookingId: string): Promise<string | undefined> => {
    // Only generate OTP for home and center services
    if (serviceStyle === 'tele') {
      return undefined;
    }
    
    try {
      const otpRes = await apiClient.post<any>('/bookings/generate-otp', {
        bookingId,
        serviceStyle,
      });
      
      if (otpRes.success && otpRes.otp) {
        return otpRes.otp;
      }
    } catch (error) {
      console.error('Error generating OTP:', error);
    }
    
    // Generate a fallback 4-digit OTP
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 cw-header-safe-top cw-header-safe-x">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Payment</h1>
            <p className="text-sm text-gray-500">Secure checkout</p>
          </div>
          <Shield className="w-6 h-6 text-green-500" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Service Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Booking Summary</h2>
          
          <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
              serviceStyle === 'tele' ? 'bg-blue-100' :
              serviceStyle === 'at_home' ? 'bg-green-100' : 'bg-purple-100'
            }`}>
              {serviceStyle === 'tele' ? '📱' : serviceStyle === 'at_home' ? '🏠' : '🏥'}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{serviceName}</h3>
              <p className="text-sm text-gray-500">{vendorName}</p>
              {duration && (
                <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> {duration} mins
                </p>
              )}
            </div>
            <p className="font-bold text-orange-600">₹{baseAmount}</p>
          </div>
          
          {/* Schedule */}
          {(bookingDate || bookingTime) && (
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Schedule</p>
                <p className="font-medium">
                  {bookingDate && new Date(bookingDate).toLocaleDateString('en-IN', { 
                    weekday: 'short', day: 'numeric', month: 'short' 
                  })}
                  {bookingTime && ` at ${bookingTime}`}
                </p>
              </div>
            </div>
          )}
          
          {/* Pet */}
          {petName && (
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <User className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Pet</p>
                <p className="font-medium">{petName}</p>
              </div>
            </div>
          )}
          
          {/* Address (for home services) */}
          {serviceStyle === 'at_home' && address && (
            <div className="flex items-center gap-3 py-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Delivery Address</p>
                <p className="font-medium">{address.label || 'Home'}</p>
                <p className="text-sm text-gray-500">
                  {address.addressLine1}, {address.city} - {address.pincode}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Coupon Section */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Coupons & Offers</h2>
            </div>
          </div>
          
          {appliedCoupon ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">{appliedCoupon.code}</p>
                  <p className="text-sm text-green-600">You save ₹{appliedCoupon.discountAmount}</p>
                </div>
              </div>
              <button onClick={removeCoupon} className="text-red-500 hover:text-red-700">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : showCouponInput ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none uppercase"
                />
                <Button
                  onClick={handleApplyCoupon}
                  disabled={couponLoading}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6"
                >
                  {couponLoading ? '...' : 'Apply'}
                </Button>
              </div>
              <button 
                onClick={() => setShowCouponInput(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCouponInput(true)}
              className="w-full flex items-center justify-between p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 transition"
            >
              <span className="text-gray-600">Have a coupon code?</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Wallet Section */}
        {wallet && wallet.balance > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <button
              onClick={() => setUseWallet(!useWallet)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${
                useWallet ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  useWallet ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  <Wallet className={`w-5 h-5 ${useWallet ? 'text-green-600' : 'text-orange-600'}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Warmpawz Wallet</p>
                  <p className="text-sm text-gray-500">Balance: ₹{wallet.balance.toFixed(2)}</p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                useWallet ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
              }`}>
                {useWallet && <CheckCircle2 className="w-4 h-4" />}
              </div>
            </button>
            {useWallet && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                ₹{walletAmount.toFixed(2)} will be deducted from wallet
              </p>
            )}
          </div>
        )}

        {/* Price Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Price Details</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Service Fee</span>
              <span>₹{taxBreakdown.subtotal.toFixed(2)}</span>
            </div>
            
            {/* GST Breakdown */}
            {taxBreakdown.isInterState ? (
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  IGST ({taxBreakdown.taxRate}%)
                  <Info className="w-3 h-3 text-gray-400" />
                </span>
                <span>₹{taxBreakdown.igst.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    CGST ({taxBreakdown.taxRate / 2}%)
                  </span>
                  <span>₹{taxBreakdown.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    SGST ({taxBreakdown.taxRate / 2}%)
                  </span>
                  <span>₹{taxBreakdown.sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            
            {/* Coupon Discount */}
            {appliedCoupon && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Coupon Discount
                </span>
                <span>-₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            
            {/* Wallet */}
            {useWallet && walletAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  Wallet
                </span>
                <span>-₹{walletAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-900">Total Amount</span>
                <span className="text-orange-600">₹{finalAmount.toFixed(2)}</span>
              </div>
              {(couponDiscount > 0 || walletAmount > 0) && (
                <p className="text-sm text-green-600 mt-1">
                  You save ₹{(couponDiscount + walletAmount).toFixed(2)} on this order!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Saved Payment Methods */}
        {savedMethods.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Saved Payment Methods</h2>
            
            <div className="space-y-3">
              {savedMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${
                    selectedMethod === method.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {method.type === 'card' ? (
                        <CreditCard className="w-5 h-5 text-gray-600" />
                      ) : method.type === 'upi' ? (
                        <Smartphone className="w-5 h-5 text-gray-600" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {method.type === 'card' 
                          ? `${method.brand || 'Card'} •••• ${method.last4}`
                          : method.type === 'upi'
                          ? method.upiId
                          : method.bankName}
                      </p>
                      {method.isDefault && (
                        <span className="text-xs text-orange-500">Default</span>
                      )}
                    </div>
                  </div>
                  {selectedMethod === method.id && (
                    <CheckCircle2 className="w-5 h-5 text-orange-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pay with Razorpay (default) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <button
            onClick={() => setSelectedMethod('razorpay')}
            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${
              selectedMethod === 'razorpay' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Pay with Razorpay</p>
                <p className="text-xs text-gray-500">Cards, UPI, NetBanking, Wallets</p>
              </div>
            </div>
            {selectedMethod === 'razorpay' && (
              <CheckCircle2 className="w-5 h-5 text-orange-500" />
            )}
          </button>
        </div>

        {/* OTP Notice for Home/Center services */}
        {serviceStyle !== 'tele' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Booking OTP</p>
                <p className="text-sm text-blue-700">
                  After payment, you'll receive a 4-digit OTP. Share this with the service provider 
                  {serviceStyle === 'at_home' ? ' when they arrive at your location' : ' at the clinic'} 
                  to start the service.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Payment Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handlePayment}
            disabled={processing}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-lg disabled:opacity-50"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                {finalAmount === 0 ? 'Confirm Booking' : `Pay ₹${finalAmount.toFixed(2)}`}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Secured by Razorpay • 100% Safe Payments
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentPage;
