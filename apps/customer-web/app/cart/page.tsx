'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { goBackOrReplace } from '@/lib/go-back-or-replace';
import {
  ShoppingCart,
  Minus,
  Plus,
  X,
  Truck,
  CreditCard,
  ArrowRight,
  Package,
  ArrowLeft,
} from 'lucide-react';

interface CartItem {
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    original_price?: number;
    emoji?: string;
    vendor_name?: string;
    stock: number;
  };
  quantity: number;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromBuyNow, setFromBuyNow] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    if (loading || !fromBuyNow || cart.length === 0) return;
    const t = window.setTimeout(() => {
      document.getElementById('cart-payment-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);
    return () => clearTimeout(t);
  }, [loading, fromBuyNow, cart.length]);

  const loadCart = () => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('warmpawz_cart');
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error('Error loading cart:', e);
        }
      }
      const q = new URLSearchParams(window.location.search);
      setFromBuyNow(q.get('buynow') === '1');
    }
    setLoading(false);
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined') {
      localStorage.setItem('warmpawz_cart', JSON.stringify(newCart));
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const newCart = cart
      .map((item) => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    saveCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    const newCart = cart.filter((item) => item.product_id !== productId);
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = subtotal > 499 ? 0 : 49;
  const total = subtotal + shippingFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const scrollPad =
    'pb-[calc(5.75rem+env(safe-area-inset-bottom,0px)+12px)]';

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#F2F4F7]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md bg-[#F2F4F7]">
      {/* App-style top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={() => goBackOrReplace(router, '/shop')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Shopping Cart</h1>
            <p className="text-sm text-slate-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
      </header>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm">
            <ShoppingCart className="h-14 w-14 text-slate-300" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">Your cart is empty</h2>
          <p className="mb-8 max-w-xs text-slate-500">Add products for your pets and they will show up here.</p>
          <button
            type="button"
            onClick={() => router.replace('/shop')}
            className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 font-semibold text-white shadow-lg active:opacity-90"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <>
          <main className={`px-3 pt-3 ${scrollPad}`}>
            {/* In-cart notice — app-style banner */}
            <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3.5 shadow-sm ring-1 ring-amber-100/80">
              <p className="font-semibold text-slate-900">Your item is in the cart</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Choose a payment method on checkout — UPI, cards, netbanking, and wallets are supported.
              </p>
            </div>

            <div className="mb-3 flex items-center justify-between px-0.5">
              <h2 className="text-base font-semibold text-slate-900">Cart Items ({itemCount})</h2>
              <button
                type="button"
                onClick={clearCart}
                className="min-h-11 min-w-[4.5rem] rounded-lg px-2 text-sm font-semibold text-red-500 active:bg-red-50"
              >
                Clear All
              </button>
            </div>

            <ul className="space-y-3">
              {cart.map((item) => (
                <li
                  key={item.product_id}
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-sky-100 text-3xl">
                      {item.product.emoji || (
                        <Package className="h-9 w-9 text-sky-500/90" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 font-semibold text-slate-900">{item.product.name}</h3>
                          <p className="mt-0.5 truncate text-sm font-medium text-orange-600">
                            {item.product.vendor_name || 'Warmpawz Store'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product_id)}
                          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 active:text-red-500"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 active:bg-slate-200"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 active:bg-slate-200 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">
                            ₹{(item.product.price * item.quantity).toFixed(0)}
                          </p>
                          <p className="text-xs text-slate-500">₹{item.product.price} each</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Order summary — stacked below items (mobile app pattern) */}
            <section className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-md">
              <h2 className="mb-4 text-base font-semibold text-slate-900">Order Summary</h2>

              <div className="mb-5 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-slate-200/90 px-5 text-sm font-semibold text-blue-900 active:bg-slate-300/90"
                >
                  Apply
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">₹{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span
                    className={
                      shippingFee === 0 ? 'font-semibold text-emerald-600' : 'font-medium text-slate-900'
                    }
                  >
                    {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                  </span>
                </div>
                {shippingFee > 0 && subtotal < 499 && (
                  <p className="text-xs text-slate-500">
                    Add ₹{(499 - subtotal).toFixed(0)} more for free shipping
                  </p>
                )}
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-lg font-bold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-orange-600">₹{total.toFixed(0)}</span>
                </div>
              </div>

              <div
                id="cart-payment-section"
                className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3.5"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                  Payment
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  After you continue, you can pay with UPI, card, netbanking, or wallets (Razorpay).
                </p>
              </div>
            </section>

            <div className="py-4 text-center">
              <button
                type="button"
                onClick={() => router.replace('/shop')}
                className="text-sm font-semibold text-orange-600 active:underline"
              >
                Continue shopping
              </button>
            </div>
          </main>

          {/* Fixed bottom bar — native checkout affordance */}
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
            <div
              className="pointer-events-auto w-full max-w-md border-t border-slate-200/90 bg-white/95 shadow-[0_-8px_32px_rgba(15,23,42,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-3 px-4 pt-3">
                <div className="min-w-0 shrink-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
                  <p className="text-xl font-bold tabular-nums text-orange-600">₹{total.toFixed(0)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/checkout')}
                  className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-semibold text-white shadow-md active:opacity-90"
                >
                  Proceed to Checkout
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
