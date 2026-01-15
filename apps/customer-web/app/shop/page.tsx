'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Search, Filter, ShoppingCart, Heart, Star, ChevronDown,
  Package, Truck, Store, Tag, X, Plus, Minus, ArrowRight,
  CreditCard, MapPin, Check, Clock, Gift, Percent
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  price: number;
  original_price?: number;
  images: string[];
  emoji?: string;
  rating: number;
  review_count: number;
  stock: number;
  vendor_id: string;
  vendor_name: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  product_count: number;
}

interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
}

interface Coupon {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  
  // UI States
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'address' | 'payment' | 'confirm'>('address');
  const [processing, setProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  
  // Address
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: ''
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
    loadCart();
  }, [selectedCategory, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy) params.append('sort', sortBy);
      
      const [productsRes, categoriesRes] = await Promise.all([
        apiClient.get<any>(`/ecommerce/products?${params.toString()}`),
        apiClient.get<any>('/ecommerce/categories'),
      ]);
      
      // Map API response to Product interface (stock_quantity -> stock)
      const productsData = ((productsRes as any)?.products || []).map((p: any) => ({
        ...p,
        stock: p.stock_quantity || p.stock || 0,
        price: parseFloat(p.price) || 0,
        original_price: p.original_price ? parseFloat(p.original_price) : undefined,
        rating: p.rating || 4.5,
        review_count: p.review_count || 0,
        images: p.images || [],
        emoji: p.emoji || '🐾',
      }));
      setProducts(productsData);
      setCategories((categoriesRes as any)?.categories || []);
    } catch (err: any) {
      console.error('Error loading shop:', err);
      setError(err.message || 'Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

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
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined') {
      localStorage.setItem('warmpawz_cart', JSON.stringify(newCart));
    }
  };

  // ============================================================================
  // CART OPERATIONS
  // ============================================================================

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product_id === product.id);
    let newCart: CartItem[];
    
    if (existing) {
      newCart = cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { product_id: product.id, product, quantity: 1 }];
    }
    
    saveCart(newCart);
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

  // ============================================================================
  // COUPON OPERATIONS
  // ============================================================================

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    try {
      const result = await apiClient.post<any>('/ecommerce/validate-coupon', {
        code: couponCode,
        order_total: cartSubtotal
      });
      
      if ((result as any)?.valid) {
        setAppliedCoupon((result as any).coupon);
        setCouponCode('');
      } else {
        alert('Invalid coupon code');
      }
    } catch (err) {
      console.error('Error applying coupon:', err);
      alert('Failed to apply coupon');
    }
  };

  // ============================================================================
  // CHECKOUT
  // ============================================================================

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setProcessing(true);
    try {
      const orderPayload = {
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product.price
        })),
        shipping_address: address,
        coupon_code: appliedCoupon?.code,
        payment_method: 'cod' // Can be extended for online payment
      };
      
      const result = await apiClient.post<any>('/ecommerce/orders', orderPayload);
      
      if ((result as any)?.order) {
        // Clear cart
        saveCart([]);
        setAppliedCoupon(null);
        setShowCheckout(false);
        
        // Show success
        alert(`Order placed successfully! Order ID: ${(result as any).order.id}`);
      }
    } catch (err: any) {
      console.error('Error placing order:', err);
      alert('Failed to place order: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? cartSubtotal * (appliedCoupon.discount_value / 100)
      : appliedCoupon.discount_value
    : 0;
  const shippingFee = cartSubtotal > 499 ? 0 : 49;
  const gstAmount = (cartSubtotal - discountAmount) * 0.18;
  const cartTotal = cartSubtotal - discountAmount + shippingFee;

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesSearch && matchesPrice;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-orange-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  WarmPawz Shop
                </h1>
                <p className="text-xs text-slate-500">Multi-Vendor Pet Marketplace</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-xl relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for pet food, accessories, toys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
              />
            </div>

            {/* Cart */}
            <button
              onClick={() => setShowCart(true)}
              className="relative p-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-lg transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Search */}
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Categories */}
        <div className="mb-6 overflow-x-auto pb-2">
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-5 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                !selectedCategory
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Products
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-5 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{cat.icon || '📦'}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filters & Sort */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{filteredProducts.length}</span> products available
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="popular">Most Popular</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="newest">Newest First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Free Shipping Banner */}
        {cartSubtotal > 0 && cartSubtotal < 499 && (
          <div className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6" />
              <div>
                <p className="font-semibold">Free Shipping on orders above ₹499!</p>
                <p className="text-sm text-emerald-100">Add ₹{499 - cartSubtotal} more to get free delivery</p>
              </div>
            </div>
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min((cartSubtotal / 499) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
              <p className="mt-4 text-slate-500">Loading products...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">Unable to load products</p>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No products found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => addToCart(product)}
                inCart={cart.some(item => item.product_id === product.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Shopping Cart</h2>
                <p className="text-sm text-slate-500">{cartItemCount} items</p>
              </div>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-100 rounded-xl">
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
                    onClick={() => setShowCart(false)}
                    className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                      <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center text-3xl border">
                        {item.product.emoji || '📦'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 line-clamp-2">{item.product.name}</h4>
                        <p className="text-sm text-slate-500">{item.product.vendor_name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-bold text-orange-600">₹{item.product.price}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product_id, -1)}
                              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="p-6 border-t border-slate-100">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl mb-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium text-emerald-700">{appliedCoupon.code}</span>
                        <span className="text-emerald-600">-₹{discountAmount.toFixed(0)}</span>
                      </div>
                      <button
                        onClick={() => setAppliedCoupon(null)}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                      <button
                        onClick={applyCoupon}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {/* Totals */}
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
                      <span className="text-orange-600">₹{cartTotal.toFixed(0)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-900">Checkout</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-center gap-4">
                {['address', 'payment', 'confirm'].map((step, index) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center gap-2 ${
                      checkoutStep === step ? 'text-orange-600' : 
                      index < ['address', 'payment', 'confirm'].indexOf(checkoutStep) ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                        checkoutStep === step ? 'bg-orange-100 text-orange-600' :
                        index < ['address', 'payment', 'confirm'].indexOf(checkoutStep) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100'
                      }`}>
                        {index < ['address', 'payment', 'confirm'].indexOf(checkoutStep) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
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
                    <MapPin className="w-5 h-5 text-orange-500" />
                    Delivery Address
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                      <input
                        value={address.name}
                        onChange={(e) => setAddress({ ...address, name: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Phone *</label>
                      <input
                        value={address.phone}
                        onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 1 *</label>
                    <input
                      value={address.line1}
                      onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                      <input
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                      <input
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">PIN Code *</label>
                      <input
                        value={address.pincode}
                        onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setCheckoutStep('payment')}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Continue to Payment
                  </button>
                </div>
              )}

              {checkoutStep === 'payment' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    Payment Method
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-4 p-4 border-2 border-orange-500 rounded-xl cursor-pointer bg-orange-50">
                      <input type="radio" name="payment" checked readOnly className="w-5 h-5 text-orange-500" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Cash on Delivery</p>
                        <p className="text-sm text-slate-500">Pay when you receive your order</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl cursor-pointer opacity-50">
                      <input type="radio" name="payment" disabled className="w-5 h-5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Online Payment</p>
                        <p className="text-sm text-slate-500">Pay with UPI, Cards, Net Banking (Coming Soon)</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCheckoutStep('address')}
                      className="flex-1 py-4 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCheckoutStep('confirm')}
                      className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl"
                    >
                      Review Order
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === 'confirm' && (
                <div className="space-y-6">
                  <h3 className="font-semibold text-slate-900">Order Summary</h3>
                  
                  {/* Items */}
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-xl border">
                          {item.product.emoji || '📦'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.product.name}</p>
                          <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-bold text-slate-900">₹{(item.product.price * item.quantity).toFixed(0)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 space-y-2">
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
                      <span className="text-orange-600">₹{cartTotal.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="font-medium text-slate-900 mb-2">Delivering to:</p>
                    <p className="text-slate-600">{address.name}, {address.phone}</p>
                    <p className="text-slate-600">{address.line1}</p>
                    <p className="text-slate-600">{address.city}, {address.state} - {address.pincode}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setCheckoutStep('payment')}
                      className="flex-1 py-4 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={processing}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          Placing Order...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Place Order
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRODUCT CARD COMPONENT
// ============================================================================

function ProductCard({ product, onAddToCart, inCart }: { product: Product; onAddToCart: () => void; inCart: boolean }) {
  const discount = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group">
      {/* Image */}
      <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-6xl relative">
        {product.emoji || '📦'}
        
        {/* Discount Badge */}
        {discount > 0 && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
            {discount}% OFF
          </div>
        )}
        
        {/* Stock Badge */}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-lg">
            Only {product.stock} left
          </div>
        )}
        
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-4 py-2 bg-white text-slate-900 font-bold rounded-lg">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Vendor */}
        <p className="text-xs text-orange-600 font-medium mb-1 flex items-center gap-1">
          <Store className="w-3 h-3" />
          {product.vendor_name || 'WarmPawz Store'}
        </p>
        
        {/* Name */}
        <h3 className="font-semibold text-slate-900 line-clamp-2 h-12 mb-2">{product.name}</h3>
        
        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-sm font-medium text-slate-900">{product.rating || 4.5}</span>
          <span className="text-sm text-slate-400">({product.review_count || 0})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-bold text-slate-900">₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-sm text-slate-400 line-through">₹{product.original_price}</span>
          )}
        </div>

        {/* Add to Cart */}
        <button
          onClick={onAddToCart}
          disabled={product.stock === 0}
          className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            product.stock === 0
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : inCart
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg'
          }`}
        >
          {product.stock === 0 ? (
            'Out of Stock'
          ) : inCart ? (
            <>
              <Check className="w-4 h-4" />
              In Cart
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
