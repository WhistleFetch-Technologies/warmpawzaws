'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ALLERGEN_LABEL, MEAL_CATEGORY_LABEL } from '@/lib/meal-product-display';

// 2D Sketch-style SVG Icons
const Icons = {
  leaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  utensils: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 21s-8-7.5-8-12a8 8 0 1116 0c0 4.5-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  creditCard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  arrowLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5 12h14" />
    </svg>
  ),
  paw: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 00-5 5 8 8 0 008 8c4.42 0 8-3.58 8-8a5 5 0 00-5-5" />
    </svg>
  ),
  shoppingBag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
    </svg>
  ),
};

interface MealProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  metadata?: any;
}

interface CartItem {
  product: MealProduct;
  quantity: number;
}

interface NutritionOrderFlowProps {
  vendorId: string;
  vendorName: string;
  customerId: string;
  onBack: () => void;
  onSuccess?: (orderId: string) => void;
}

type FlowStep = 'menu' | 'cart' | 'delivery' | 'payment' | 'confirmation' | 'tracking';

export default function NutritionOrderFlow({ vendorId, vendorName, customerId, onBack, onSuccess }: NutritionOrderFlowProps) {
  const [step, setStep] = useState<FlowStep>('menu');
  const [products, setProducts] = useState<MealProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [petName, setPetName] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('pending');

  useEffect(() => {
    fetchProducts();
  }, [vendorId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/meal-products`);
      if (response && (response as any).success) {
        setProducts((response as any).products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: MealProduct) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.product.id !== productId));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    try {
      const orderData = {
        customerId,
        vendorId,
        orderType: 'meal_plan_delivery',
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        totalAmount: getCartTotal() + 40, // + delivery
        deliveryAddress,
        deliveryNotes,
        petName,
        paymentMethod,
      };

      const response = await apiClient.post('/nutrition/delivery-orders', orderData);
      if (response && (response as any).success) {
        setOrderId((response as any).order?.id || 'ORD-' + Date.now());
        setStep('confirmation');
        if (onSuccess) {
          onSuccess((response as any).order?.id);
        }
      }
    } catch (error) {
      console.error('Error placing order:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                {Icons.arrowLeft}
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">{vendorName}</h1>
                <p className="text-sm text-slate-500">Fresh Pet Meals</p>
              </div>
            </div>

            {step === 'menu' && cart.length > 0 && (
              <button
                onClick={() => setStep('cart')}
                className="relative p-2 bg-emerald-100 rounded-lg text-emerald-600"
              >
                {Icons.shoppingBag}
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center">
                  {getCartItemCount()}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Step 1: Menu */}
        {step === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                {Icons.leaf}
              </div>
              <span className="font-medium">Fresh & Healthy Meals</span>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {Icons.utensils}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Meals Available</h3>
                <p className="text-slate-500">This nutritionist hasn't added any meals yet</p>
              </div>
            ) : (
              products.map((product) => {
                const metadata = product.metadata ? (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata) : {};
                const cartItem = cart.find(item => item.product.id === product.id);
                
                return (
                  <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/80 rounded-xl flex items-center justify-center text-emerald-600">
                        {Icons.utensils}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-800">{product.name}</h3>
                        <span className="text-lg font-bold text-emerald-600">₹{product.price}</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">{product.description}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {metadata.dietType && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            metadata.dietType === 'Veg' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {metadata.dietType}
                          </span>
                        )}
                        {metadata.nutritionalValue?.calories && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs flex items-center gap-1">
                            {Icons.fire} {metadata.nutritionalValue.calories}
                          </span>
                        )}
                        {(metadata.petTypes || []).map((pt: string) => (
                          <span key={pt} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            {pt}
                          </span>
                        ))}
                        {Array.isArray(metadata.mealCategories) &&
                          (metadata.mealCategories as string[]).slice(0, 5).map((c: string) => (
                            <span key={c} className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded text-xs">
                              {MEAL_CATEGORY_LABEL[c] || c.replace(/_/g, ' ')}
                            </span>
                          ))}
                        {Array.isArray(metadata.allergens) &&
                          (metadata.allergens as string[]).map((a: string) => (
                            <span
                              key={a}
                              className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-xs"
                              title="Contains allergen"
                            >
                              {ALLERGEN_LABEL[a] || a}
                            </span>
                          ))}
                      </div>

                      {cartItem ? (
                        <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-2">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm"
                          >
                            {Icons.minus}
                          </button>
                          <span className="font-semibold text-emerald-700">{cartItem.quantity}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white"
                          >
                            {Icons.plus}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {Icons.plus}
                          <span>Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
                <div className="max-w-lg mx-auto">
                  <button
                    onClick={() => setStep('cart')}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-between px-4"
                  >
                    <span>View Cart ({getCartItemCount()} items)</span>
                    <span>₹{getCartTotal()}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Cart Review */}
        {step === 'cart' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {Icons.shoppingBag}
              Your Cart
            </h2>

            {cart.map((item) => (
              <div key={item.product.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-800">{item.product.name}</h3>
                    <p className="text-sm text-slate-500">₹{item.product.price} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600"
                    >
                      {Icons.minus}
                    </button>
                    <span className="font-semibold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => addToCart(item.product)}
                      className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"
                    >
                      {Icons.plus}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{item.product.price * item.quantity}</span>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Items Total</span>
                <span className="text-slate-700">₹{getCartTotal()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Delivery Fee</span>
                <span className="text-slate-700">₹40</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-100">
                <span className="text-slate-800">Total</span>
                <span className="text-emerald-600">₹{getCartTotal() + 40}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('menu')}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
              >
                Add More
              </button>
              <button
                onClick={() => setStep('delivery')}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Delivery Details */}
        {step === 'delivery' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {Icons.truck}
              Delivery Details
            </h2>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet's Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {Icons.paw}
                  </span>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Who is this meal for?"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    {Icons.mapPin}
                  </span>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Enter your full delivery address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Special Instructions (Optional)</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                  placeholder="Any allergies or special requests?"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('cart')}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep('payment')}
                disabled={!deliveryAddress || !petName}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 'payment' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {Icons.creditCard}
              Payment
            </h2>

            {/* Order Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-medium text-slate-800 mb-3">Order Summary</h3>
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">{item.product.name} x {item.quantity}</span>
                  <span className="text-slate-800">₹{item.product.price * item.quantity}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-1 border-t border-slate-100 mt-2 pt-2">
                <span className="text-slate-600">Delivery</span>
                <span className="text-slate-800">₹40</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-slate-100 mt-2">
                <span className="text-slate-800">Total</span>
                <span className="text-emerald-600">₹{getCartTotal() + 40}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <button
                onClick={() => setPaymentMethod('online')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'online'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  paymentMethod === 'online' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {Icons.creditCard}
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-slate-800">Pay Now</p>
                  <p className="text-sm text-slate-500">UPI / Card / Netbanking</p>
                </div>
                {paymentMethod === 'online' && <span className="text-emerald-600">{Icons.check}</span>}
              </button>

              <button
                onClick={() => setPaymentMethod('cod')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  paymentMethod === 'cod' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {Icons.cash}
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-slate-800">Cash on Delivery</p>
                  <p className="text-sm text-slate-500">Pay when order arrives</p>
                </div>
                {paymentMethod === 'cod' && <span className="text-emerald-600">{Icons.check}</span>}
              </button>
            </div>

            <button
              onClick={handlePlaceOrder}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
            >
              {paymentMethod === 'online' ? `Pay ₹${getCartTotal() + 40}` : 'Place Order'}
            </button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 'confirmation' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              {Icons.check}
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Order Placed!</h2>
            <p className="text-slate-500 mb-6">Your fresh pet meal is being prepared</p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Order ID</span>
                <span className="font-medium text-slate-800">{orderId}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">For</span>
                <span className="font-medium text-slate-800">{petName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Total</span>
                <span className="font-medium text-emerald-600">₹{getCartTotal() + 40}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Payment</span>
                <span className="font-medium text-slate-800">{paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('tracking')}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium"
              >
                Track Order
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Tracking */}
        {step === 'tracking' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {Icons.truck}
              Track Your Order
            </h2>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-slate-800">Order #{orderId?.slice(-8)}</p>
                  <p className="text-sm text-slate-500">For {petName}</p>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                  {orderStatus}
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { status: 'Order Placed', completed: true, icon: Icons.check },
                  { status: 'Preparing', completed: orderStatus !== 'pending', icon: Icons.utensils },
                  { status: 'Ready', completed: ['ready', 'dispatched', 'delivered'].includes(orderStatus), icon: Icons.leaf },
                  { status: 'Out for Delivery', completed: ['dispatched', 'delivered'].includes(orderStatus), icon: Icons.truck },
                  { status: 'Delivered', completed: orderStatus === 'delivered', icon: Icons.check },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      item.completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${item.completed ? 'text-slate-800' : 'text-slate-400'}`}>
                        {item.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onBack}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
            >
              Back to Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
