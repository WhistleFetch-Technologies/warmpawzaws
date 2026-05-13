'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, MapPin, CreditCard, CheckCircle, ArrowLeft,
  Truck, Shield, Tag, Plus, ChevronRight, AlertCircle, Package
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { goBackOrHome, rememberShopBackFromCurrentUrl } from '@/lib/go-back-or-replace';
import { CustomerPlacementBanners } from '@/components/customer/shared/CustomerPlacementBanners';
import { clearWarmpawzCartStorage, WARMPAWZ_CART_KEY } from '@/lib/warmpawz-cart-storage';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  vendorId: string;
  vendorName?: string;
}

/** `warmpawz_cart` stores `{ product_id, product, quantity }` lines from `/shop`. */
function normalizeStoredCartLines(raw: unknown[]): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: unknown, idx: number) => {
    const row = entry as Record<string, unknown>;
    const nested = row?.product as Record<string, unknown> | undefined;
    if (nested && typeof nested === 'object') {
      const productId = String(row.product_id || nested.id || '');
      const price = Number(nested.price) || 0;
      const qty = Math.max(1, Number(row.quantity) || 1);
      const images = nested.images as string[] | undefined;
      const image = Array.isArray(images) && images[0] ? String(images[0]) : undefined;
      return {
        id: productId || `cart-${idx}`,
        productId,
        name: String(nested.name ?? ''),
        price,
        quantity: qty,
        image,
        vendorId: String(nested.vendor_id ?? ''),
        vendorName: nested.vendor_name != null ? String(nested.vendor_name) : undefined,
      };
    }
    return {
      id: String(row.id ?? row.productId ?? `cart-${idx}`),
      productId: String(row.productId ?? row.id ?? ''),
      name: String(row.name ?? ''),
      price: Number(row.price) || 0,
      quantity: Math.max(1, Number(row.quantity) || 1),
      image: row.image != null ? String(row.image) : undefined,
      vendorId: String(row.vendorId ?? ''),
      vendorName: row.vendorName != null ? String(row.vendorName) : undefined,
    };
  });
}

interface Address {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  addressType: 'home' | 'work' | 'other';
  coordinates?: {
    lat: number;
    lng: number;
  };
  latitude?: number;
  longitude?: number;
}

type CheckoutStep = 'address' | 'payment' | 'review' | 'confirmation';

export default function CheckoutPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    addressType: 'home',
  });
  const [countryCode, setCountryCode] = useState(() => {
    // Get saved country code or default to +91
    if (typeof window !== 'undefined') {
      return localStorage.getItem('customerCountryCode') || '+91';
    }
    return '+91';
  });
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'wallet'>('cod');
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  
  // Order state
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    try {
      setLoading(true);
      const customerId = getResolvedCustomerId();
      
      // Load cart from localStorage
      const savedCart = localStorage.getItem(WARMPAWZ_CART_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as unknown;
        const raw = Array.isArray(parsed) ? parsed : [];
        const items = normalizeStoredCartLines(raw);
        setCartItems(items);

        // Calculate totals
        const sub = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
        setSubtotal(sub);
        setShippingFee(sub >= 499 ? 0 : 49);
        setTax(Math.round(sub * 0.18)); // 18% GST
        setTotal(sub + (sub >= 499 ? 0 : 49) + Math.round(sub * 0.18));
      }

      // Load addresses
      if (customerId) {
        try {
          const addressData = await apiClient.get<{ addresses?: Address[] }>(`/customer/${customerId}/addresses`);
          const addrs = addressData?.addresses || [];
          setAddresses(addrs);
          const defaultAddr = addrs.find(a => a.isDefault);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          }
        } catch (e) {
          console.warn('Could not load addresses');
        }

        // Load wallet balance
        try {
          const walletData = await apiClient.get<{ balance?: number | string }>(`/wallet/${customerId}`);
          setWalletBalance(Number(walletData?.balance ?? 0) || 0);
        } catch (e) {
          console.warn('Could not load wallet');
        }
      }
    } catch (error) {
      console.error('Error loading checkout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      setCouponError('');
      const result = await apiClient.get<any>(`/coupons/validate/${couponCode}?amount=${subtotal}`);
      
      if (result.valid) {
        setAppliedCoupon(result.coupon);
        const discountAmount = result.coupon.discountType === 'percentage'
          ? Math.min(subtotal * result.coupon.discountValue / 100, result.coupon.maxDiscount || Infinity)
          : result.coupon.discountValue;
        setDiscount(discountAmount);
        setTotal(subtotal + shippingFee + tax - discountAmount);
      } else {
        setCouponError(result.message || 'Invalid coupon code');
      }
    } catch (error: any) {
      setCouponError(error.message || 'Failed to validate coupon');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode('');
    setTotal(subtotal + shippingFee + tax);
  };

  const handleAddAddress = async () => {
    if (!newAddress.fullName || !newAddress.phone || !newAddress.addressLine1 || 
        !newAddress.city || !newAddress.state || !newAddress.pincode) {
      return;
    }

    try {
      const customerId = getResolvedCustomerId();
      const result = await apiClient.post<{ address?: Address }>(`/customer/${customerId}/addresses`, newAddress);
      
      if (result.address) {
        setAddresses([...addresses, result.address]);
        setSelectedAddressId(result.address.id);
        setShowAddAddress(false);
        setNewAddress({ addressType: 'home' });
      }
    } catch (error: any) {
      console.error('Error adding address:', error);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      alert('Please select a delivery address');
      return;
    }

    try {
      setSubmitting(true);
      const customerId = getResolvedCustomerId();
      const selectedAddress = addresses.find(a => a.id === selectedAddressId);

      const orderData = {
        customerId,
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          vendorId: item.vendorId,
        })),
        shippingAddress: selectedAddress,
        paymentMethod,
        subtotal,
        shippingFee,
        taxAmount: tax,
        discountAmount: discount,
        couponCode: appliedCoupon?.code || null,
        totalAmount: total,
        useWallet,
        walletAmount: useWallet ? Math.min(walletBalance, total) : 0,
      };

      // For online payment, first create order then initiate Razorpay
      if (paymentMethod === 'online') {
        const result = await apiClient.post<{ order?: { id: string; orderNumber: string } }>('/ecommerce/orders', orderData);
        
        if (result.order) {
          // Initialize Razorpay payment
          await initiateRazorpayPayment(result.order.id, total - (useWallet ? Math.min(walletBalance, total) : 0));
        }
      } else {
        // COD - place order directly
        const result = await apiClient.post<{ order?: { id: string; orderNumber: string } }>('/ecommerce/orders', orderData);
        
        if (result.order) {
          setOrderId(result.order.id);
          setCurrentStep('confirmation');
          
          // Clear cart
          clearWarmpawzCartStorage();
          setCartItems([]);
        }
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      alert(error.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const initiateRazorpayPayment = async (orderId: string, amount: number) => {
    try {
      // Create Razorpay order
      const razorpayOrder = await apiClient.post<{ orderId: string; keyId: string; amount: number; currency: string }>('/razorpay/create-order', {
        bookingId: orderId,
        amount,
        customerId: getResolvedCustomerId(),
      });

      if (!razorpayOrder?.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Load Razorpay script if not loaded
      if (!(window as any).Razorpay) {
        await loadRazorpayScript();
      }

      const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
      const checkoutEmail = selectedAddr?.phone
        ? await fetchCheckoutEmailForPrefill(String(selectedAddr.phone))
        : undefined;

      const options = buildSanitizedStandardRazorpayCheckoutOptions({
        key: razorpayOrder.keyId,
        amountPaise: Math.max(1, Math.round(Number(razorpayOrder.amount) * 100)),
        currency: razorpayOrder.currency || 'INR',
        name: 'Warmpawz',
        description: 'Order Payment',
        order_id: razorpayOrder.orderId,
        customerPhone: selectedAddr?.phone,
        customerEmail: checkoutEmail,
        prefillName: selectedAddr?.fullName,
        includeInstrumentBlocks: true,
        handler: async (response: any) => {
          try {
            // Verify payment
            await apiClient.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Payment successful
            setOrderId(orderId);
            setCurrentStep('confirmation');
            clearWarmpawzCartStorage();
            setCartItems([]);
          } catch (err: any) {
            console.error('Payment verification failed:', err);
            alert('Payment verification failed. Please contact support.');
          }
        },
        theme: {
          color: '#f97316', // orange-500
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          },
        },
      });

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Razorpay initialization failed:', error);
      alert('Payment initialization failed. Please try again.');
      setSubmitting(false);
    }
  };

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

  const steps = [
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'review', label: 'Review', icon: ShoppingCart },
    { id: 'confirmation', label: 'Done', icon: CheckCircle },
  ];

  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-orange-300" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="mb-6 text-gray-500">Online checkout is not available yet.</p>
          <button
            type="button"
            onClick={() => goBackOrHome(router)}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-semibold text-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0 && currentStep !== 'confirmation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add some products to proceed to checkout</p>
          <button
            onClick={() => {
              rememberShopBackFromCurrentUrl();
              router.push('/shop');
            }}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50 cw-header-safe-top cw-header-safe-x">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => goBackOrHome(router)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Checkout</h1>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isPast = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center gap-2 ${isActive ? 'text-orange-600' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-orange-100' : isPast ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="hidden sm:block font-medium">{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className={`w-5 h-5 mx-2 ${isPast ? 'text-green-400' : 'text-gray-300'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4">
        <CustomerPlacementBanners placement="checkout" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Address Step */}
            {currentStep === 'address' && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  Delivery Address
                </h2>

                {addresses.length === 0 && !showAddAddress ? (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No saved addresses</p>
                    <button
                      onClick={() => setShowAddAddress(true)}
                      className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg font-medium hover:bg-orange-200"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add New Address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map(address => (
                      <label
                        key={address.id}
                        className={`block p-4 border-2 rounded-xl cursor-pointer transition ${
                          selectedAddressId === address.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddressId === address.id}
                            onChange={() => setSelectedAddressId(address.id)}
                            className="mt-1 accent-orange-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">{address.fullName}</span>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                                {address.addressType}
                              </span>
                              {address.isDefault && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">Default</span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm">
                              {address.addressLine1}
                              {address.addressLine2 && `, ${address.addressLine2}`}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            <p className="text-gray-500 text-sm mt-1">📞 {address.phone}</p>
                          </div>
                        </div>
                      </label>
                    ))}

                    {!showAddAddress && (
                      <button
                        onClick={() => setShowAddAddress(true)}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-orange-400 hover:text-orange-500 transition"
                      >
                        <Plus className="w-5 h-5 inline mr-2" />
                        Add New Address
                      </button>
                    )}
                  </div>
                )}

                {/* Add Address Form */}
                {showAddAddress && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-4">Add New Address</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={newAddress.fullName || ''}
                        onChange={e => setNewAddress({ ...newAddress, fullName: e.target.value })}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <div className="flex items-stretch border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 bg-white">
                        <CountryCodeSelector
                          selectedCode={countryCode}
                          onSelect={setCountryCode}
                          disabled={false}
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="Phone Number *"
                          value={newAddress.phone || ''}
                          onChange={e => setNewAddress({ ...newAddress, phone: e.target.value.replace(/[^0-9]/g, '') })}
                          maxLength={10}
                          className="flex-1 px-4 py-3 outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <EnhancedAddressAutocomplete
                          value={newAddress.addressLine1 || ''}
                          onChange={(address: string, components?: AddressComponents) => {
                            const updates: Partial<Address> = { addressLine1: address };
                            // Auto-populate city, state, pincode from Google Maps selection
                            if (components) {
                              if (components.city) updates.city = components.city;
                              if (components.state) updates.state = components.state;
                              if (components.pincode) updates.pincode = components.pincode;
                              if (components.landmark) updates.landmark = components.landmark;
                              if (components.coordinates) {
                                updates.coordinates = components.coordinates;
                                updates.latitude = components.coordinates.lat;
                                updates.longitude = components.coordinates.lng;
                              }
                            }
                            setNewAddress({ ...newAddress, ...updates });
                          }}
                          placeholder="Search address, landmark, city... *"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Address Line 2"
                        value={newAddress.addressLine2 || ''}
                        onChange={e => setNewAddress({ ...newAddress, addressLine2: e.target.value })}
                        className="sm:col-span-2 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="City *"
                        value={newAddress.city || ''}
                        onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={newAddress.state || ''}
                        onChange={e => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={newAddress.pincode || ''}
                        onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                        maxLength={6}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="Landmark"
                        value={newAddress.landmark || ''}
                        onChange={e => setNewAddress({ ...newAddress, landmark: e.target.value })}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <select
                        value={newAddress.addressType}
                        onChange={e => setNewAddress({ ...newAddress, addressType: e.target.value as any })}
                        className="sm:col-span-2 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setShowAddAddress(false)}
                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddAddress}
                        className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                      >
                        Save Address
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setCurrentStep('payment')}
                  disabled={!selectedAddressId}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition"
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {/* Payment Step */}
            {currentStep === 'payment' && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  Payment Method
                </h2>

                <div className="space-y-3">
                  <label
                    className={`block p-4 border-2 rounded-xl cursor-pointer transition ${
                      paymentMethod === 'cod' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="accent-orange-500"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-800">Cash on Delivery</span>
                        <p className="text-sm text-gray-500">Pay when your order is delivered</p>
                      </div>
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  </label>

                  <label
                    className={`block p-4 border-2 rounded-xl cursor-pointer transition ${
                      paymentMethod === 'online' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'online'}
                        onChange={() => setPaymentMethod('online')}
                        className="accent-orange-500"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-800">Pay Online</span>
                        <p className="text-sm text-gray-500">Cards, UPI, Net Banking, Wallets via Razorpay</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <img src="https://cdn.razorpay.com/static/assets/logo/payment.svg" alt="Razorpay" className="h-6" />
                      </div>
                    </div>
                  </label>

                  {walletBalance > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-green-800">Use Wallet Balance</span>
                          <p className="text-sm text-green-600">Available: ₹{walletBalance.toLocaleString()}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useWallet}
                            onChange={e => setUseWallet(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setCurrentStep('address')}
                    className="px-6 py-4 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep('review')}
                    className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
                  >
                    Review Order
                  </button>
                </div>
              </div>
            )}

            {/* Review Step */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                {/* Order Items */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-orange-500" />
                    Order Items ({cartItems.length})
                  </h2>
                  <div className="divide-y">
                    {cartItems.map(item => (
                      <div key={item.id} className="py-4 flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-800">{item.name}</h3>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-800">₹{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-500" />
                    Delivery Address
                  </h2>
                  {selectedAddressId && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      {(() => {
                        const addr = addresses.find(a => a.id === selectedAddressId);
                        if (!addr) return null;
                        return (
                          <>
                            <p className="font-semibold text-gray-800">{addr.fullName}</p>
                            <p className="text-gray-600">{addr.addressLine1}</p>
                            <p className="text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                            <p className="text-gray-500">📞 {addr.phone}</p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    Payment Method
                  </h2>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="font-medium text-gray-800">
                      {paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Online Payment'}
                    </p>
                    {useWallet && (
                      <p className="text-sm text-green-600 mt-1">
                        + Using ₹{Math.min(walletBalance, total).toLocaleString()} from wallet
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep('payment')}
                    className="px-6 py-4 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50"
                  >
                    {submitting ? 'Placing Order...' : `Place Order • ₹${total.toLocaleString()}`}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Step */}
            {currentStep === 'confirmation' && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully! 🎉</h2>
                <p className="text-gray-500 mb-6">Thank you for your order. We'll send you updates via SMS.</p>
                
                {orderId && (
                  <div className="p-4 bg-orange-50 rounded-xl mb-6">
                    <p className="text-sm text-gray-600">Order ID</p>
                    <p className="font-mono font-bold text-orange-600">{orderId}</p>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => router.push('/orders')}
                    className="px-6 py-3 border border-orange-500 text-orange-600 rounded-xl font-medium hover:bg-orange-50"
                  >
                    View Orders
                  </button>
                  <button
                    onClick={() => {
                      rememberShopBackFromCurrentUrl();
                      router.push('/shop');
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          {currentStep !== 'confirmation' && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-32">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>
                
                {/* Coupon */}
                <div className="mb-4">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="text-green-700 font-medium">{appliedCoupon.code}</span>
                      </div>
                      <button onClick={handleRemoveCoupon} className="text-red-500 text-sm hover:underline">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg font-medium hover:bg-orange-200 text-sm"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {couponError}
                    </p>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                    <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className={shippingFee === 0 ? 'text-green-600 font-medium' : ''}>
                      {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18% GST)</span>
                    <span className="font-medium">₹{tax.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-₹{discount.toLocaleString()}</span>
                    </div>
                  )}
                  {useWallet && walletBalance > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Wallet</span>
                      <span className="font-medium">-₹{Math.min(walletBalance, total).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between text-lg">
                    <span className="font-bold text-gray-800">Total</span>
                    <span className="font-bold text-orange-600">
                      ₹{(total - (useWallet ? Math.min(walletBalance, total) : 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Truck className="w-5 h-5 text-green-500" />
                    <span>Free delivery on orders above ₹499</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span>100% Secure Payment</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
