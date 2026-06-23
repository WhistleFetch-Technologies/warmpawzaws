'use client';

import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import type { ShopCartItem, ShopCoupon } from './shop-types';

interface ShopCartSheetProps {
  open: boolean;
  cart: ShopCartItem[];
  cartItemCount: number;
  cartSubtotal: number;
  cartTotal: number;
  shippingFee: number;
  discountAmount: number;
  appliedCoupon: ShopCoupon | null;
  couponCode: string;
  onClose: () => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onCouponCodeChange: (code: string) => void;
  onApplyCoupon: () => void;
  onClearCoupon: () => void;
  onProceedCheckout: () => void;
}

export function ShopCartSheet({
  open,
  cart,
  cartItemCount,
  cartSubtotal,
  cartTotal,
  shippingFee,
  discountAmount,
  appliedCoupon,
  couponCode,
  onClose,
  onUpdateQuantity,
  onRemove,
  onCouponCodeChange,
  onApplyCoupon,
  onClearCoupon,
  onProceedCheckout,
}: ShopCartSheetProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close cart"
        onClick={onClose}
      />
      <div className="relative w-full max-h-[min(88dvh,36rem)] rounded-t-[1.75rem] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
        <div className="pt-2 pb-1 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="px-4 pt-2 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your cart</h2>
            <p className="text-xs text-slate-500">{cartItemCount} items</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-50 active:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-medium">Your cart is empty</p>
              <p className="text-sm text-slate-400 mt-1">Add some products to get started</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-[#FF8C42] text-white rounded-lg"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="flex gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center text-3xl border">
                    {item.product.emoji || '📦'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 line-clamp-2">{item.product.name}</h4>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-bold text-[#FF8C42]">₹{item.product.price}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product_id, -1)}
                          className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product_id, 1)}
                          className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.product_id)}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 pt-3 border-t border-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-700">{appliedCoupon.code}</span>
                    <span className="text-emerald-600">-₹{discountAmount.toFixed(0)}</span>
                  </div>
                  <button type="button" onClick={onClearCoupon} className="text-emerald-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={onApplyCoupon}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                  >
                    Apply
                  </button>
                </div>
              )}

              <div className="space-y-2 mb-4">
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
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-[#FF8C42]">₹{cartTotal.toFixed(0)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedCheckout}
                className="w-full py-4 bg-[#FF8C42] text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
