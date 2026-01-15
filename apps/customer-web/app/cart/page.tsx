'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Minus, Plus, X, Tag, Truck, MapPin, CreditCard,
  ArrowRight, Check, Package, ArrowLeft
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

  useEffect(() => {
    loadCart();
  }, []);

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
    const newCart = cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    saveCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    const newCart = cart.filter(item => item.product_id !== productId);
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const shippingFee = subtotal > 499 ? 0 : 49;
  const total = subtotal + shippingFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-orange-50/30">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/shop')}
            className="p-2 hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Shopping Cart</h1>
            <p className="text-sm text-slate-500">{itemCount} items</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <ShoppingCart className="w-20 h-20 mx-auto mb-6 text-slate-200" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
            <p className="text-slate-500 mb-6">Add some products to get started</p>
            <button
              onClick={() => router.push('/shop')}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Cart Items ({itemCount})</h2>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-500 hover:text-red-600 font-medium"
                >
                  Clear All
                </button>
              </div>

              {cart.map(item => (
                <div key={item.product_id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex gap-5">
                    <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center text-4xl">
                      {item.product.emoji || '📦'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-lg">{item.product.name}</h3>
                          <p className="text-sm text-orange-600">{item.product.vendor_name || 'WarmPawz Store'}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateQuantity(item.product_id, -1)}
                            className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center text-lg font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, 1)}
                            className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-slate-900">₹{(item.product.price * item.quantity).toFixed(0)}</p>
                          <p className="text-sm text-slate-400">₹{item.product.price} each</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm sticky top-24">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>
                
                {/* Coupon */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium">
                    Apply
                  </button>
                </div>

                {/* Totals */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="text-slate-900 font-medium">₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className={shippingFee === 0 ? 'text-emerald-600 font-medium' : 'text-slate-900 font-medium'}>
                      {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                    </span>
                  </div>
                  {shippingFee > 0 && (
                    <p className="text-xs text-slate-500">
                      Add ₹{499 - subtotal} more for free shipping
                    </p>
                  )}
                  <div className="border-t border-slate-100 pt-3 flex justify-between">
                    <span className="text-lg font-bold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-orange-600">₹{total.toFixed(0)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Trust Badges */}
                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Truck className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-slate-500">Free Shipping</p>
                  </div>
                  <div>
                    <Package className="w-6 h-6 mx-auto text-blue-500 mb-1" />
                    <p className="text-xs text-slate-500">Easy Returns</p>
                  </div>
                  <div>
                    <Tag className="w-6 h-6 mx-auto text-amber-500 mb-1" />
                    <p className="text-xs text-slate-500">Best Prices</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
