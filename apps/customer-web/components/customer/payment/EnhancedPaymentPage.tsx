'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CreditCard, Wallet, Tag, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, Shield, X, Percent, Info, MapPin, Minus, Plus,
  Clock, Calendar, User, Smartphone, Gift, Sparkles, AlertCircle, 
  Loader2, Coins, History, CreditCard as CardIcon, Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  image?: string;
  type: 'service' | 'product' | 'package';
  serviceStyle?: 'at_home' | 'at_center' | 'tele' | 'delivery';
  duration?: number;
  vendorId?: string;
  vendorName?: string;
}

interface EnhancedPaymentPageProps {
  // Items (supports multiple)
  items: CartItem[];
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  
  // Booking context (for single service bookings)
  bookingId?: string;
  orderId?: string;
  type: 'booking' | 'order' | 'cart';
  
  // Schedule (for bookings)
  bookingDate?: string;
  bookingTime?: string;
  
  // Pet (for bookings)
  petId?: string;
  petName?: string;
  petBreed?: string;
  
  // Address
  address?: {
    id?: string;
    label?: string;
    addressLine1?: string;
    city?: string;
    pincode?: string;
  };
  showAddressSelection?: boolean;
  
  // Customer
  customerPhone: string;
  customerId?: string;
  
  // Navigation
  onBack: () => void;
  onSuccess: (bookingId: string, orderId?: string, otpCode?: string) => void;
}

interface WalletInfo {
  balance: number;
  currency: string;
  loyaltyPoints?: number;
  rewardsBalance?: number;
  pendingCredits?: number;
}

interface CouponResult {
  valid: boolean;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  minAmount?: number;
  maxDiscount?: number;
}

interface BankOffer {
  id: string;
  bankName: string;
  cardType: 'credit' | 'debit';
  discountType: 'cashback' | 'discount' | 'emi';
  discountValue: number;
  minAmount: number;
  maxDiscount: number;
  description: string;
  logo?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EnhancedPaymentPage({
  items,
  onUpdateQuantity,
  onRemoveItem,
  bookingId,
  orderId,
  type,
  bookingDate,
  bookingTime,
  petId,
  petName,
  petBreed,
  address,
  showAddressSelection = false,
  customerPhone,
  customerId,
  onBack,
  onSuccess,
}: EnhancedPaymentPageProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  
  // Bank offers
  const [bankOffers, setBankOffers] = useState<BankOffer[]>([]);
  const [selectedBankOffer, setSelectedBankOffer] = useState<BankOffer | null>(null);
  const [showAllOffers, setShowAllOffers] = useState(false);
  
  // UI state
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    wallet: false,
    offers: false,
    breakdown: true,
  });

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = 0.18; // 18% GST
  const taxAmount = subtotal * taxRate;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const bankOfferDiscount = selectedBankOffer ? Math.min(
    selectedBankOffer.discountType === 'discount' 
      ? (subtotal * selectedBankOffer.discountValue / 100) 
      : selectedBankOffer.discountValue,
    selectedBankOffer.maxDiscount
  ) : 0;
  
  const totalBeforeWallet = Math.max(0, subtotal + taxAmount - couponDiscount - bankOfferDiscount);
  const walletDeduction = useWallet ? Math.min(walletAmountToUse, totalBeforeWallet, wallet?.balance || 0) : 0;
  const finalAmount = Math.max(0, totalBeforeWallet - walletDeduction);
  const totalSavings = couponDiscount + bankOfferDiscount + walletDeduction;

  useEffect(() => {
    loadPaymentData();
    loadRazorpayScript();
    loadBankOffers();
  }, [customerPhone]);

  useEffect(() => {
    // Auto-set wallet amount to use
    if (wallet && useWallet) {
      setWalletAmountToUse(Math.min(wallet.balance, totalBeforeWallet));
    }
  }, [wallet, useWallet, totalBeforeWallet]);

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
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBankOffers = async () => {
    try {
      const res = await apiClient.get<any>(`/razorpay/offers?amount=${subtotal}`);
      if (res.success && res.offers) {
        setBankOffers(res.offers);
      } else {
        // Mock offers for demo
        setBankOffers([
          {
            id: 'hdfc1',
            bankName: 'HDFC Bank',
            cardType: 'credit',
            discountType: 'cashback',
            discountValue: 10,
            minAmount: 500,
            maxDiscount: 200,
            description: '10% cashback up to ₹200',
            logo: '🏦'
          },
          {
            id: 'icici1',
            bankName: 'ICICI Bank',
            cardType: 'credit',
            discountType: 'discount',
            discountValue: 5,
            minAmount: 1000,
            maxDiscount: 500,
            description: '5% instant discount up to ₹500',
            logo: '🏦'
          },
          {
            id: 'axis1',
            bankName: 'Axis Bank',
            cardType: 'debit',
            discountType: 'cashback',
            discountValue: 50,
            minAmount: 300,
            maxDiscount: 50,
            description: 'Flat ₹50 cashback on debit cards',
            logo: '🏦'
          },
          {
            id: 'sbi1',
            bankName: 'SBI Card',
            cardType: 'credit',
            discountType: 'emi',
            discountValue: 0,
            minAmount: 3000,
            maxDiscount: 0,
            description: 'No-cost EMI available',
            logo: '🏦'
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading bank offers:', error);
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
        `/coupons/validate/${couponCode.toUpperCase()}?amount=${subtotal}`
      );
      
      if (res.valid) {
        const discountAmount = res.coupon.discount_type === 'percentage'
          ? Math.min((subtotal * res.coupon.discount_value / 100), res.coupon.max_discount || Infinity)
          : res.coupon.discount_value;
        
        setAppliedCoupon({
          valid: true,
          code: couponCode.toUpperCase(),
          discountType: res.coupon.discount_type,
          discountValue: res.coupon.discount_value,
          discountAmount,
          minAmount: res.coupon.min_amount,
          maxDiscount: res.coupon.max_discount,
        });
        toast.success(`Coupon applied! You save ₹${discountAmount.toFixed(0)}`);
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

  const toggleBankOffer = (offer: BankOffer) => {
    if (selectedBankOffer?.id === offer.id) {
      setSelectedBankOffer(null);
    } else {
      setSelectedBankOffer(offer);
      toast.success(`${offer.bankName} offer selected!`);
    }
  };

  const handlePayment = async () => {
    if (items.length === 0) {
      toast.error('No items to pay for');
      return;
    }
    
    setProcessing(true);
    
    try {
      // Step 1: Create booking/order if needed
      let currentBookingId = bookingId;
      let currentOrderId = orderId;
      
      if (type === 'booking' && !currentBookingId && items.length === 1) {
        const item = items[0];
        
        // Validate required fields before making API call
        if (!customerId) {
          throw new Error('Customer ID is required. Please log in again.');
        }
        if (!item.vendorId) {
          throw new Error('Vendor information is missing. Please try again.');
        }
        if (!item.id) {
          throw new Error('Service information is missing. Please try again.');
        }
        if (!bookingDate || !bookingTime) {
          throw new Error('Booking date and time are required.');
        }
        
        // Map serviceStyle to backend serviceType
        // Backend expects: 'at_vendor', 'at_home', 'tele' (or 'online' which maps to 'tele')
        const serviceTypeMap: Record<string, string> = {
          'at_center': 'at_vendor',
          'at_home': 'at_home',
          'tele': 'tele',
          'online': 'tele',
          'delivery': 'at_home', // Delivery is similar to at_home
        };
        const mappedServiceType = serviceTypeMap[item.serviceStyle || 'at_center'] || 'at_vendor';
        
        const bookingPayload = {
          customerId,
          vendorId: item.vendorId,
          serviceId: item.id,
          bookingDate,
          bookingTime,
          serviceType: mappedServiceType,
          amount: finalAmount,
          petId: petId || undefined,
          address: address?.addressLine1 || undefined,
          notes: '',
        };
        
        console.log('📋 Creating booking with payload:', bookingPayload);
        
        try {
          const bookingRes = await apiClient.post<any>('/bookings/create', bookingPayload);
          
          currentBookingId = bookingRes.data?.bookingId || bookingRes.bookingId || bookingRes.booking?.id || bookingRes.id;
          if (!currentBookingId) {
            console.error('❌ Booking response:', bookingRes);
            throw new Error('Failed to create booking: No booking ID returned');
          }
          console.log('✅ Booking created successfully:', currentBookingId);
        } catch (bookingError: any) {
          // Enhanced error logging
          console.error('❌ /bookings/create failed with non-404 error:', bookingError);
          console.error('❌ Payment error:', bookingError);
          console.error('❌ Error response:', (bookingError as any)?.response || (bookingError as any)?.responseData);
          console.error('❌ Error data:', (bookingError as any)?.responseData);
          console.error('❌ Error status:', (bookingError as any)?.status || (bookingError as any)?.statusCode);
          console.error('❌ Error message:', bookingError?.message);
          
          // Extract detailed error message
          const errorResponse = (bookingError as any)?.response || (bookingError as any)?.responseData;
          const errorMessage = 
            errorResponse?.error?.message || 
            errorResponse?.error || 
            errorResponse?.message ||
            bookingError?.message || 
            'Failed to create booking. Please check all required fields and try again.';
          
          throw new Error(errorMessage);
        }
      }
      
      // Step 2: If fully paid with wallet
      if (finalAmount === 0 && walletDeduction > 0) {
        // Deduct from wallet
        await apiClient.post<any>(`/wallet/${customerId}/debit`, {
          amount: walletDeduction,
          referenceType: type,
          referenceId: currentBookingId || currentOrderId,
          description: `Payment for ${items.map(i => i.name).join(', ')}`,
        });
        
        toast.success('Payment completed with wallet!');
        onSuccess(currentBookingId || '', currentOrderId);
        return;
      }
      
      // Step 3: Create Razorpay order
      const orderRes = await apiClient.post<any>('/razorpay/create-order', {
        bookingId: currentBookingId,
        orderId: currentOrderId,
        amount: finalAmount,
        customerId,
        offerId: selectedBankOffer?.id,
      });
      
      if (!orderRes.orderId) {
        throw new Error('Failed to create payment order');
      }
      
      // Step 4: Open Razorpay checkout with mobile-optimized config
      const options = {
        key: orderRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: finalAmount * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: items.length === 1 
          ? items[0].name 
          : `${items.length} items`,
        order_id: orderRes.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            await apiClient.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            
            // Deduct wallet if used
            if (walletDeduction > 0) {
              await apiClient.post<any>(`/wallet/${customerId}/debit`, {
                amount: walletDeduction,
                referenceType: type,
                referenceId: currentBookingId || currentOrderId || response.razorpay_payment_id,
                description: `Partial payment for ${items.map(i => i.name).join(', ')}`,
              });
            }
            
            // Apply coupon if used
            if (appliedCoupon) {
              await apiClient.post('/coupons/apply', {
                couponCode: appliedCoupon.code,
                bookingId: currentBookingId,
                orderId: currentOrderId,
                customerId,
                amount: subtotal,
              });
            }
            
            toast.success('Payment successful!');
            onSuccess(currentBookingId || '', currentOrderId);
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
          backdrop_color: 'rgba(0,0,0,0.7)',
        },
        // Mobile optimizations
        config: {
          display: {
            blocks: {
              banks: {
                name: 'Pay using UPI/Cards',
                instruments: [
                  { method: 'upi' },
                  { method: 'card' },
                  { method: 'netbanking' },
                  { method: 'wallet' },
                ],
              },
            },
            sequence: ['block.banks'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info('Payment cancelled');
          },
          confirm_close: true,
          escape: false,
          animation: true,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
      };
      
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Payment gateway not loaded');
      }
      
    } catch (error: any) {
      // Enhanced error logging
      console.error('❌ Payment error:', error);
      console.error('❌ Error response:', (error as any)?.response || (error as any)?.responseData);
      console.error('❌ Error data:', (error as any)?.responseData);
      console.error('❌ Error status:', (error as any)?.status || (error as any)?.statusCode);
      console.error('❌ Error message:', error?.message);
      
      // Extract detailed error message from API response
      const errorResponse = (error as any)?.response || (error as any)?.responseData;
      const errorMessage = 
        errorResponse?.error?.message || 
        errorResponse?.error || 
        errorResponse?.message ||
        error?.message || 
        'Payment failed. Please try again or contact support.';
      
      toast.error(errorMessage);
      setProcessing(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50/30 pb-48">
      {/* Header - Sleek & Modern */}
      <header className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
            <p className="text-sm text-white/80">{items.length} item{items.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        
        {/* Itemized Cart - Professional Layout */}
        <Card className="bg-white rounded-3xl shadow-sm border-0 overflow-hidden">
          <button 
            onClick={() => toggleSection('items')}
            className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-gray-900">Your Items</h2>
                <p className="text-sm text-gray-500">{items.length} item{items.length > 1 ? 's' : ''} • ₹{subtotal.toLocaleString()}</p>
              </div>
            </div>
            {expandedSections.items ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {expandedSections.items && (
            <div className="px-5 pb-5 space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className={`${index > 0 ? 'pt-4 border-t border-gray-100' : ''}`}>
                  <div className="flex gap-4">
                    {/* Item Image/Icon */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-3xl flex-shrink-0 border border-orange-200/50">
                      {item.image || (item.type === 'service' ? '🐕' : item.type === 'package' ? '📦' : '🛒')}
                    </div>
                    
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                          {item.vendorName && (
                            <p className="text-sm text-gray-500">{item.vendorName}</p>
                          )}
                          {item.serviceStyle && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {item.serviceStyle === 'at_home' ? '🏠 At Home' : 
                               item.serviceStyle === 'at_center' ? '🏥 At Center' : 
                               item.serviceStyle === 'tele' ? '📱 Video Call' : '🚚 Delivery'}
                            </Badge>
                          )}
                          {item.duration && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.duration} mins
                            </p>
                          )}
                        </div>
                        
                        {/* Price */}
                        <p className="font-bold text-orange-600 text-lg whitespace-nowrap">
                          ₹{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                      
                      {/* Quantity Controls */}
                      {onUpdateQuantity && item.type !== 'service' && (
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  onUpdateQuantity(item.id, item.quantity - 1);
                                } else if (onRemoveItem) {
                                  onRemoveItem(item.id);
                                }
                              }}
                              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="w-10 text-center font-semibold text-gray-900">{item.quantity}</span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {onRemoveItem && (
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="text-sm text-red-500 hover:text-red-600 font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Schedule & Pet Info (for bookings) */}
        {type === 'booking' && (bookingDate || petName) && (
          <Card className="bg-white rounded-3xl p-5 shadow-sm border-0">
            <div className="space-y-3">
              {bookingDate && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Schedule</p>
                    <p className="font-medium text-gray-900">
                      {new Date(bookingDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                      {bookingTime && ` at ${bookingTime}`}
                    </p>
                  </div>
                </div>
              )}
              
              {petName && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-xl">
                    🐕
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pet</p>
                    <p className="font-medium text-gray-900">{petName} {petBreed && `(${petBreed})`}</p>
                  </div>
                </div>
              )}
              
              {address && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500">Delivery Address</p>
                    <p className="font-medium text-gray-900 truncate">{address.label || 'Home'}</p>
                    <p className="text-sm text-gray-500 truncate">{address.addressLine1}, {address.city}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Wallet Section - Beautiful Design */}
        {wallet && wallet.balance > 0 && (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-sm border-0 overflow-hidden">
            <button 
              onClick={() => toggleSection('wallet')}
              className="w-full px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h2 className="font-semibold text-gray-900">Warmpawz Wallet</h2>
                  <p className="text-sm">
                    <span className="text-green-600 font-bold">₹{wallet.balance.toLocaleString()}</span>
                    <span className="text-gray-500"> available</span>
                  </p>
                </div>
              </div>
              {expandedSections.wallet ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            
            {expandedSections.wallet && (
              <div className="px-5 pb-5 space-y-4">
                {/* Use Wallet Toggle */}
                <button
                  onClick={() => setUseWallet(!useWallet)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    useWallet 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        useWallet ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {useWallet && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className="font-medium text-gray-900">Use wallet balance</span>
                    </div>
                    <span className="font-bold text-green-600">-₹{Math.min(wallet.balance, totalBeforeWallet).toLocaleString()}</span>
                  </div>
                </button>
                
                {useWallet && (
                  <div className="space-y-3">
                    {/* Amount Slider */}
                    <div className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Amount to use</span>
                        <span className="font-bold text-orange-600">₹{walletAmountToUse.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.min(wallet.balance, totalBeforeWallet)}
                        value={walletAmountToUse}
                        onChange={(e) => setWalletAmountToUse(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>₹0</span>
                        <span>₹{Math.min(wallet.balance, totalBeforeWallet).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-green-600 flex items-center gap-2 px-2">
                      <CheckCircle2 className="w-4 h-4" />
                      ₹{walletDeduction.toLocaleString()} will be deducted from wallet
                    </p>
                  </div>
                )}
                
                {wallet.loyaltyPoints && wallet.loyaltyPoints > 0 && (
                  <div className="flex items-center gap-2 px-2 text-amber-600">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">{wallet.loyaltyPoints} loyalty points available</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Coupons & Offers Section */}
        <Card className="bg-white rounded-3xl shadow-sm border-0 overflow-hidden">
          <button 
            onClick={() => toggleSection('offers')}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Tag className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-gray-900">Coupons & Offers</h2>
                <p className="text-sm text-gray-500">
                  {appliedCoupon ? `${appliedCoupon.code} applied` : 
                   selectedBankOffer ? `${selectedBankOffer.bankName} offer` : 
                   `${bankOffers.length} offers available`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(appliedCoupon || selectedBankOffer) && (
                <Badge className="bg-green-100 text-green-700">
                  -₹{(couponDiscount + bankOfferDiscount).toLocaleString()}
                </Badge>
              )}
              {expandedSections.offers ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </button>
          
          {expandedSections.offers && (
            <div className="px-5 pb-5 space-y-4">
              {/* Applied Coupon */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-green-700">{appliedCoupon.code}</p>
                      <p className="text-sm text-green-600">You save ₹{appliedCoupon.discountAmount.toLocaleString()}</p>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="text-red-500 hover:text-red-600">
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
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none uppercase font-medium"
                    />
                    <Button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 rounded-xl"
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
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
                  className="w-full flex items-center justify-between p-4 border-2 border-dashed border-gray-200 rounded-2xl hover:border-orange-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <Percent className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600 font-medium">Have a coupon code?</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              )}
              
              {/* Bank Offers */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CardIcon className="w-4 h-4" />
                  Bank Offers
                </h3>
                
                {(showAllOffers ? bankOffers : bankOffers.slice(0, 2)).map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => toggleBankOffer(offer)}
                    disabled={offer.minAmount > subtotal}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      selectedBankOffer?.id === offer.id
                        ? 'border-blue-500 bg-blue-50'
                        : offer.minAmount > subtotal
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xl">
                        {offer.logo || '🏦'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{offer.bankName}</span>
                          <Badge variant="outline" className="text-xs">
                            {offer.cardType}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{offer.description}</p>
                        {offer.minAmount > subtotal && (
                          <p className="text-xs text-red-500 mt-1">Min. order ₹{offer.minAmount}</p>
                        )}
                      </div>
                      {selectedBankOffer?.id === offer.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
                
                {bankOffers.length > 2 && (
                  <button
                    onClick={() => setShowAllOffers(!showAllOffers)}
                    className="w-full text-center text-sm text-orange-600 font-medium py-2 hover:text-orange-700"
                  >
                    {showAllOffers ? 'Show less' : `+${bankOffers.length - 2} more offers`}
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Price Breakdown - Clean Design */}
        <Card className="bg-white rounded-3xl shadow-sm border-0 overflow-hidden">
          <button 
            onClick={() => toggleSection('breakdown')}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-gray-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Price Details</h2>
            </div>
            {expandedSections.breakdown ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {expandedSections.breakdown && (
            <div className="px-5 pb-5 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} item{items.length > 1 ? 's' : ''})</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Percent className="w-4 h-4" />
                    Coupon Discount
                  </span>
                  <span>-₹{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              
              {bankOfferDiscount > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span className="flex items-center gap-1">
                    <Gift className="w-4 h-4" />
                    Bank Offer
                  </span>
                  <span>-₹{bankOfferDiscount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  GST (18%)
                  <Info className="w-3 h-3 text-gray-400" />
                </span>
                <span>₹{taxAmount.toLocaleString()}</span>
              </div>
              
              {walletDeduction > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    Wallet
                  </span>
                  <span>-₹{walletDeduction.toLocaleString()}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-orange-600">₹{finalAmount.toLocaleString()}</span>
                    {totalSavings > 0 && (
                      <p className="text-sm text-green-600 font-medium">You save ₹{totalSavings.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Shield className="w-5 h-5 text-green-500" />
            <span className="text-sm">100% Secure</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span className="text-sm">Trusted by 1M+ users</span>
          </div>
        </div>
      </main>

      {/* Fixed Bottom CTA - Premium Design */}
      {/* Increased z-index to ensure it's above footer navigation (footer typically uses z-50) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200 shadow-2xl z-[100]">
        <div className="max-w-lg mx-auto p-4 space-y-3 pb-safe">
          {/* Savings Banner */}
          {totalSavings > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-semibold">You're saving ₹{totalSavings.toLocaleString()} on this order!</span>
            </div>
          )}
          
          {/* Pay Button */}
          <Button
            onClick={handlePayment}
            disabled={processing || items.length === 0}
            className="w-full py-6 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 hover:from-orange-600 hover:via-orange-500 hover:to-amber-600 text-white rounded-2xl font-bold text-lg disabled:opacity-50 shadow-xl shadow-orange-500/30 transition-all hover:shadow-2xl hover:shadow-orange-500/40"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {finalAmount === 0 ? 'Confirm Order' : `Pay ₹${finalAmount.toLocaleString()}`}
              </span>
            )}
          </Button>
          
          {/* Security Note */}
          <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Secured by Razorpay • 100% Safe Payments
          </p>
        </div>
      </div>
    </div>
  );
}

// Needed for CartContext usage
import { ShoppingBag } from 'lucide-react';

export default EnhancedPaymentPage;
