'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Check, CreditCard, MapPin, X } from 'lucide-react';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import type { ShopCartItem, ShopCoupon } from './shop-types';

interface CheckoutAddress {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

interface ShopCheckoutModalProps {
  open: boolean;
  cart: ShopCartItem[];
  cartItemCount: number;
  cartSubtotal: number;
  cartTotal: number;
  shippingFee: number;
  discountAmount: number;
  checkoutStep: 'address' | 'payment' | 'confirm';
  showPaymentPage: boolean;
  processing: boolean;
  address: CheckoutAddress;
  customerPhone: string;
  customerId?: string;
  onClose: () => void;
  onAddressChange: (address: CheckoutAddress) => void;
  onCheckoutStepChange: (step: 'address' | 'payment' | 'confirm') => void;
  onShowPaymentPage: (show: boolean) => void;
  onPlaceOrder: () => void;
  onPaymentSuccess: (bookingId: string, orderId?: string) => void;
}

export function ShopCheckoutModal({
  open,
  cart,
  cartItemCount,
  cartSubtotal,
  cartTotal,
  shippingFee,
  discountAmount,
  checkoutStep,
  showPaymentPage,
  processing,
  address,
  customerPhone,
  customerId,
  onClose,
  onAddressChange,
  onCheckoutStepChange,
  onShowPaymentPage,
  onPlaceOrder,
  onPaymentSuccess,
}: ShopCheckoutModalProps) {
  const router = useRouter();

  if (!open) return null;

  const steps = ['address', 'payment', 'confirm'] as const;
  const currentStepIndex = steps.indexOf(checkoutStep);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-900">Checkout</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-center gap-4">
            {steps.map((step, index) => (
              <React.Fragment key={step}>
                <div
                  className={`flex items-center gap-2 ${
                    checkoutStep === step
                      ? 'text-orange-600'
                      : index < currentStepIndex
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      checkoutStep === step
                        ? 'bg-orange-100 text-orange-600'
                        : index < currentStepIndex
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-100'
                    }`}
                  >
                    {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className="font-medium capitalize hidden sm:block">{step}</span>
                </div>
                {index < 2 && <div className="w-12 h-0.5 bg-slate-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6">
          {checkoutStep === 'address' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                Delivery Address
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input
                    value={address.name}
                    onChange={(e) => onAddressChange({ ...address, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone *</label>
                  <input
                    value={address.phone}
                    onChange={(e) => onAddressChange({ ...address, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 1 *</label>
                <input
                  value={address.line1}
                  onChange={(e) => onAddressChange({ ...address, line1: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                  <input
                    value={address.city}
                    onChange={(e) => onAddressChange({ ...address, city: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                  <input
                    value={address.state}
                    onChange={(e) => onAddressChange({ ...address, state: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">PIN Code *</label>
                  <input
                    value={address.pincode}
                    onChange={(e) => onAddressChange({ ...address, pincode: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCheckoutStepChange('payment')}
                className="w-full py-4 bg-[#FF8C42] text-white rounded-xl font-semibold shadow-lg"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {checkoutStep === 'payment' && !showPaymentPage && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FF8C42]" />
                Payment Method
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-4 p-4 border-2 border-[#FF8C42] rounded-xl cursor-pointer bg-orange-50">
                  <input type="radio" name="payment" checked readOnly className="w-5 h-5 text-[#FF8C42]" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Cash on Delivery</p>
                    <p className="text-sm text-slate-500">Pay when you receive your order</p>
                  </div>
                </label>
                <label
                  onClick={() => router.push('/checkout')}
                  className="flex items-center gap-4 p-4 border-2 border-[#FF8C42] rounded-xl cursor-pointer bg-orange-50 hover:bg-orange-100 transition"
                >
                  <input type="radio" name="payment" className="w-5 h-5 text-[#FF8C42]" readOnly />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Online Payment</p>
                    <p className="text-sm text-slate-500">Pay with UPI, Cards, Net Banking via Razorpay</p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onCheckoutStepChange('address')}
                  className="flex-1 py-4 border border-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => onCheckoutStepChange('confirm')}
                  className="flex-1 py-4 bg-[#FF8C42] text-white rounded-xl font-semibold shadow-lg"
                >
                  Review Order (COD)
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 'payment' && showPaymentPage && cart.length > 0 && (
            <UniversalPaymentPage
              type="order"
              productId={cart[0]?.product_id}
              productName={`Order: ${cart.length} item(s)`}
              serviceStyle="ecom"
              category="ecommerce"
              vendorId={cart[0]?.product?.vendor_id || ''}
              vendorName={cart[0]?.product?.vendor_name || 'Warmpawz Store'}
              address={{
                label: address.name || 'Delivery Address',
                addressLine1: address.line1,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
              }}
              showAddressSelection={false}
              baseAmount={cartTotal}
              quantity={cartItemCount}
              customerPhone={customerPhone || address.phone}
              customerId={customerId}
              onBack={() => onShowPaymentPage(false)}
              onSuccess={onPaymentSuccess}
            />
          )}

          {checkoutStep === 'confirm' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-900">Order Summary</h3>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-xl border">
                      {item.product.emoji || '📦'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-bold text-slate-900">
                      ₹{(item.product.price * item.quantity).toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-orange-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">₹{cartSubtotal.toFixed(0)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Discount</span>
                    <span className="text-emerald-600">-₹{discountAmount.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Shipping</span>
                  <span className={shippingFee === 0 ? 'text-emerald-600' : 'text-slate-900'}>
                    {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-orange-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-[#FF8C42]">₹{cartTotal.toFixed(0)}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="font-medium text-slate-900 mb-2">Delivering to:</p>
                <p className="text-slate-600">
                  {address.name}, {address.phone}
                </p>
                <p className="text-slate-600">{address.line1}</p>
                <p className="text-slate-600">
                  {address.city}, {address.state} - {address.pincode}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => onCheckoutStepChange('payment')}
                    className="flex-1 py-4 border border-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={onPlaceOrder}
                    disabled={processing}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Place Order (COD)
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!address.name || !address.phone || !address.line1 || !address.city || !address.pincode) {
                      alert('Please fill in all address fields');
                      return;
                    }
                    onCheckoutStepChange('payment');
                    onShowPaymentPage(true);
                  }}
                  disabled={processing}
                  className="w-full py-4 bg-[#FF8C42] text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Online (Razorpay)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
