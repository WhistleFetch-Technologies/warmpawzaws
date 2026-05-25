"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, CreditCard, Edit2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { CustomerPlacementBanners } from '@/components/customer/shared/CustomerPlacementBanners';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { useEcommerceCheckout, type CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import {
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';

interface CheckoutViewProps {
  phone: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
  onNavigate?: (screen: string, data?: unknown) => void;
  variant?: 'shell' | 'standalone';
}

export function CheckoutView({
  phone,
  onBack,
  onSuccess,
  onNavigate,
  variant = 'shell',
}: CheckoutViewProps) {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const { getPricing, placeOrder } = useEcommerceCheckout();
  const [selectedAddress, setSelectedAddress] = useState<CheckoutAddress | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('online');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const commerceEnabled = isCustomerEcommerceEnabled();

  const pricing = useMemo(() => getPricing(cart), [cart, getPricing]);
  const { taxResult } = pricing;

  const refreshAddresses = useCallback(
    async (opts?: { preserveSelection?: boolean; pickDefaultIfMissing?: boolean }) => {
      const preserveSelection = opts?.preserveSelection ?? false;
      const pickDefaultIfMissing = opts?.pickDefaultIfMissing ?? !preserveSelection;
      try {
        const list = await loadCustomerDeliveryAddresses(phone);
        setAddresses(list);
        setSelectedAddress((prev) => {
          if (preserveSelection && prev) {
            const match = list.find((a) => a.id === prev.id);
            if (match) return match;
            if (!pickDefaultIfMissing) return prev;
          }
          if (pickDefaultIfMissing) return pickDefaultDeliveryAddress(list);
          return prev;
        });
        return list;
      } catch (error) {
        console.error('Error loading addresses:', error);
        setAddresses([]);
        if (!preserveSelection) setSelectedAddress(null);
        return [];
      }
    },
    [phone]
  );

  const loadAddresses = async () => {
    setAddressesLoading(true);
    await refreshAddresses();
    setAddressesLoading(false);
  };

  useEffect(() => {
    if (!commerceEnabled) return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, commerceEnabled]);

  const openAddressPicker = async () => {
    setShowAddressPicker(true);
    setPickerLoading(true);
    try {
      await refreshAddresses({ preserveSelection: true, pickDefaultIfMissing: false });
    } catch {
      toast.error('Failed to load addresses');
    } finally {
      setPickerLoading(false);
    }
  };

  const handleAddressSelect = (addr: DeliveryAddress) => {
    setSelectedAddress(addr);
    toast.success('Address updated');
  };

  const handleAddAddressSuccess = async (newAddress: CheckoutAddress) => {
    setShowAddAddressModal(false);
    const list = await refreshAddresses({ preserveSelection: false, pickDefaultIfMissing: false });
    const match =
      list.find((a) => a.id && newAddress?.id && a.id === newAddress.id) ??
      (newAddress?.id ? newAddress : pickDefaultDeliveryAddress(list));
    if (match) setSelectedAddress(match);
    toast.success('Address saved');
  };

  const handleManageAddresses = () => {
    if (variant === 'shell' && onNavigate) {
      onNavigate('account/addresses');
    } else {
      router.push('/profile');
    }
  };

  const openAddAddressModal = () => {
    setShowAddressPicker(false);
    setShowAddAddressModal(true);
  };

  const handlePayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    try {
      await placeOrder({
        phone,
        cart,
        pricing,
        shippingAddress: selectedAddress,
        paymentMethod,
        onSuccess: (orderId) => {
          toast.success(
            paymentMethod === 'cod'
              ? 'Order placed successfully! Pay on delivery.'
              : 'Order placed successfully!'
          );
          onSuccess(orderId);
        },
        onProcessingChange: setProcessing,
        clearCart,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      if (message !== 'Payment cancelled') {
        toast.error(message);
      }
      setProcessing(false);
    }
  };

  if (!commerceEnabled) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 rounded-lg bg-white/90 p-2 shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">Checkout will be available when the marketplace launches.</p>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Checkout</h1>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-gray-600 mb-6">Your cart is empty</p>
            <Button
              onClick={onBack}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const shellMax = variant === 'standalone' ? 'max-w-customer mx-auto w-full' : 'max-w-md mx-auto';

  return (
    <div className={`min-h-screen bg-gray-50 pb-24 ${shellMax}`}>
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white sticky top-0 z-10 py-4 rounded-b-2xl shadow-md cw-header-safe-x pt-[max(3rem,calc(env(safe-area-inset-top,0px)+0.75rem))]">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Checkout</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <CustomerPlacementBanners placement="checkout" onNavigate={onNavigate} />

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={openAddressPicker}
                className="text-[#FF8C42] hover:text-[#FF6B9D]"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Change
              </Button>
            </div>
            {addressesLoading ? (
              <p className="text-sm text-gray-500">Loading address…</p>
            ) : selectedAddress ? (
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  {selectedAddress.fullName || selectedAddress.name || 'Default Address'}
                </p>
                <p>{selectedAddress.addressLine1 || selectedAddress.street}</p>
                <p>
                  {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                </p>
                <p className="mt-1">Phone: {selectedAddress.phone || phone}</p>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="mb-3">No saved address. Add one to continue checkout.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openAddAddressModal}
                  className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
                >
                  Add address
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-gray-500">
                      Qty: {item.quantity} × ₹{item.price}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{pricing.lineSubtotal.toFixed(2)}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="text-green-600">-₹{pricing.discount.toFixed(2)}</span>
                </div>
              )}
              {pricing.deliveryFees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className="text-gray-900">₹{pricing.deliveryFees.toFixed(2)}</span>
                </div>
              )}
              {(pricing.giftWrapFee > 0 || pricing.protectionFee > 0) && (
                <>
                  {pricing.giftWrapFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Gift wrap</span>
                      <span className="text-gray-900">₹{pricing.giftWrapFee.toFixed(2)}</span>
                    </div>
                  )}
                  {pricing.protectionFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Protection</span>
                      <span className="text-gray-900">₹{pricing.protectionFee.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {taxResult.byType.map((taxType) => (
                <div key={taxType.taxType} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {taxType.taxType === 'gst'
                      ? 'GST'
                      : taxType.taxType === 'service_tax'
                        ? 'Service Tax'
                        : taxType.taxType.toUpperCase()}
                    {taxType.breakdown.length > 0 && ` (${taxType.breakdown[0].rate}%)`}
                  </span>
                  <span className="text-gray-900">₹{taxType.totalAmount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total</span>
                <span className="text-[#FF8C42]">₹{pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('online')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'online'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      paymentMethod === 'online' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">Online Payment</h3>
                    <p className="text-sm text-gray-500">Pay securely via Razorpay</p>
                  </div>
                  {paymentMethod === 'online' && (
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      paymentMethod === 'cod' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">Cash on Delivery (COD)</h3>
                    <p className="text-sm text-gray-500">Pay when you receive your order</p>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg z-40">
            <Button
              onClick={handlePayment}
              disabled={processing || addressesLoading || !selectedAddress}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-14 text-lg font-semibold shadow-lg shadow-[#FF8C42]/30 disabled:opacity-50"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : paymentMethod === 'cod' ? (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Place Order (COD) ₹{pricing.total.toFixed(2)}
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay ₹{pricing.total.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DeliveryAddressPickerSheet
        open={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelect={handleAddressSelect}
        onAddNew={openAddAddressModal}
        onManageAddresses={handleManageAddresses}
        loading={pickerLoading}
        phone={phone}
      />

      <AddAddressModal
        phone={phone}
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSuccess={handleAddAddressSuccess}
        customerName={selectedAddress?.fullName || selectedAddress?.name || ''}
      />
    </div>
  );
}
