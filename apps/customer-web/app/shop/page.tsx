'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  Search, Filter, ShoppingCart, Heart, Star, ChevronDown,
  Package, Truck, Store, Tag, X, Plus, Minus, ArrowRight,
  CreditCard, MapPin, Check, Clock, Gift, Percent, ArrowLeft,
} from 'lucide-react';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { handleShopPageBack, markWishlistOpenedFromShop } from '@/lib/go-back-or-replace';
import { WishlistProductHeartButton } from '@/components/customer/WishlistProductHeartButton';
import { formatAverageForDisplay } from '@/lib/rating-display';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { emitWarmpawzCartUpdated, WARMPAWZ_CART_KEY } from '@/lib/warmpawz-cart-storage';

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
  const router = useRouter();
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
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  
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
    loadCustomerData();
  }, [selectedCategory, sortBy]);

  const loadCustomerData = () => {
    if (typeof window !== 'undefined') {
      // Try to get customer phone from localStorage or sessionStorage
      const phone = localStorage.getItem('customer_phone') || 
                   sessionStorage.getItem('customer_phone') ||
                   localStorage.getItem('phone') ||
                   sessionStorage.getItem('phone') ||
                   '';
      setCustomerPhone(phone);
      
      const id = getResolvedCustomerId() || undefined;
      setCustomerId(id);
    }
  };

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
      
      // Map API response to Product interface (stock_quantity -> stock); stable id for links / cart / wishlist
      const rawList = (productsRes as any)?.products || [];
      const productsData = rawList.map((p: any) => {
        const id = canonicalProductId(p);
        if (!id && typeof console !== 'undefined' && console.warn) {
          console.warn('[shop] product row missing canonical id', {
            keys: p && typeof p === 'object' ? Object.keys(p) : [],
            sample: p,
          });
        }
        const compareOrOriginal = p.original_price ?? p.compare_at_price;
        const rc = Number(p.review_count ?? 0) || 0;
        const rawRating = p.rating != null ? Number(p.rating) : NaN;
        const rating =
          rc > 0 && Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0;
        return {
          ...p,
          id,
          stock: p.stock_quantity || p.stock || 0,
          price: parseFloat(p.price) || 0,
          original_price:
            compareOrOriginal != null && String(compareOrOriginal) !== ''
              ? parseFloat(String(compareOrOriginal))
              : undefined,
          rating,
          review_count: rc,
          images: p.images || [],
          emoji: p.emoji || '🐾',
        };
      });
      if (rawList.length > 0 && typeof console !== 'undefined' && console.log) {
        const first = rawList[0];
        console.log('[shop] catalog sample', {
          firstRowKeys: first && typeof first === 'object' ? Object.keys(first) : [],
          canonicalId: canonicalProductId(first),
        });
      }
      setProducts(productsData.filter((p: Product) => Boolean(p.id)));
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
      const savedCart = localStorage.getItem(WARMPAWZ_CART_KEY);
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
      localStorage.setItem(WARMPAWZ_CART_KEY, JSON.stringify(newCart));
      emitWarmpawzCartUpdated();
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
    
    // Validate address before proceeding to payment
    if (!address.name || !address.phone || !address.line1 || !address.city || !address.pincode) {
      alert('Please fill in all address fields');
      return;
    }

    // Validate customer phone
    if (!customerPhone && !address.phone) {
      alert('Please provide your phone number');
      return;
    }

    // Proceed to payment page
    setShowPaymentPage(true);
  };

  const handlePaymentSuccess = async (bookingId: string, orderId?: string) => {
    // UniversalPaymentPage creates the order internally, so we just need to handle UI cleanup
    if (orderId) {
      // Clear cart
      saveCart([]);
      setAppliedCoupon(null);
      setShowCheckout(false);
      setShowPaymentPage(false);
      setCheckoutStep('address');
      
      // Show success - could redirect to order success page
      alert(`Order placed successfully! Order ID: ${orderId}`);
      
      // Optionally redirect to order details or order history
      // window.location.href = `/orders/${orderId}`;
    } else {
      console.error('No order ID received from payment');
      alert('Payment successful but order ID not received. Please check your order history.');
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

  const sortLabels: Record<string, string> = {
    popular: 'Most popular',
    price_low: 'Price: Low to high',
    price_high: 'Price: High to low',
    newest: 'Newest first',
    rating: 'Highest rated',
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesSearch && matchesPrice;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className="min-h-[100dvh] bg-slate-200/90 md:py-5 md:px-4 flex flex-col items-center">
        <div className="w-full max-w-md min-h-[100dvh] md:min-h-0 md:h-[min(100dvh-2.5rem,56rem)] md:rounded-[2rem] bg-white md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)] md:ring-1 md:ring-slate-200/80 overflow-hidden flex flex-col">
          <header className="px-5 pt-[max(4rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3 md:pt-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => handleShopPageBack(router)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/90 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </header>
          <main className="flex-1 flex items-center justify-center px-6 text-center">
            <div>
              <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-orange-50 flex items-center justify-center">
                <ShoppingCart className="w-10 h-10 text-orange-500" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Shop coming soon</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                We&apos;re preparing the Warmpawz marketplace for customers. Please check back later.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-200/90 md:py-5 md:px-4 flex flex-col items-center">
      {/* App shell: fixed readable width like a native shop screen */}
      <div className="w-full max-w-md min-h-[100dvh] md:min-h-0 md:h-[min(100dvh-2.5rem,56rem)] md:rounded-[2rem] bg-white md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)] md:ring-1 md:ring-slate-200/80 overflow-hidden flex flex-col relative min-w-0">
      {/* Sticky app header */}
      <header className="sticky top-0 z-40 isolate shrink-0 bg-white/95 backdrop-blur-lg border-b border-slate-100 min-w-0 w-full max-w-full">
        <div className="px-5 min-w-0 pt-[max(4rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-2 md:pt-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 min-h-[2.75rem]">
            <button
              type="button"
              onClick={() => handleShopPageBack(router)}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/90 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0 flex-1 py-0.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md shadow-orange-500/25">
                <Store className="w-[1.125rem] h-[1.125rem] sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-0">
                <h1 className="text-[0.9375rem] sm:text-base font-bold leading-snug bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent truncate">
                  Warmpawz Shop
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug truncate mt-0.5">Multi-vendor pet marketplace</p>
              </div>
            </div>
            <a
              href="/wishlist"
              onClick={() => markWishlistOpenedFromShop()}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:scale-95 transition-transform"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="relative shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[1.125rem] h-[1.125rem] text-slate-400 pointer-events-none" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search food, toys, accessories…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-2xl border border-slate-200/90 bg-slate-50/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-400 transition-colors"
            />
          </div>
        </div>

        {/* Categories — horizontal scroll, snap (min-w-0 so row can scroll inside max-w-md shell) */}
        <div className="pl-5 pr-4 pb-3 w-full max-w-full min-w-0 overflow-x-auto overflow-y-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory touch-pan-x">
          <div className="flex gap-2 pb-0.5 w-max pr-5">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`snap-start shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                !selectedCategory
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/25'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`snap-start shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/25'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50'
                }`}
              >
                <span className="text-base leading-none opacity-90">{cat.icon || '📦'}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 pb-3 flex items-center justify-between gap-2 border-t border-slate-50 min-w-0">
          <p className="text-xs text-slate-500">
            <span className="font-bold text-slate-800 text-sm">{filteredProducts.length}</span>
            <span className="text-slate-400"> · </span>
            products
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200/90 active:bg-slate-100"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200/90 active:bg-slate-100 max-w-[9.5rem]"
            >
              <span className="truncate">{sortLabels[sortBy] || 'Sort'}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-2 pb-[max(6rem,env(safe-area-inset-bottom,0px)+4.5rem)] [-webkit-overflow-scrolling:touch]">

        {/* Free shipping nudge */}
        {cartSubtotal > 0 && cartSubtotal < 499 && (
          <div className="mb-3 rounded-2xl p-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug">Free delivery over ₹499</p>
                <p className="text-xs text-emerald-50/95 mt-0.5">Add ₹{499 - cartSubtotal} more</p>
                <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((cartSubtotal / 499) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-orange-200 border-t-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-600">Loading catalogue…</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-3 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-100">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-700 font-semibold text-sm">Couldn&apos;t load products</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl shadow-md shadow-orange-500/20"
            >
              Try again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 px-3 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-100">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-700 font-semibold text-sm">No products match</p>
            <p className="text-xs text-slate-400 mt-1">Try another category or search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 min-w-0 w-full items-stretch [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
            {filteredProducts.map((product) => (
              <div key={product.id} className="min-w-0 max-w-full flex min-h-0">
                <ProductCard
                  product={product}
                  onAddToCart={() => addToCart(product)}
                  inCart={cart.some((item) => item.product_id === product.id)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sort sheet */}
      {showSortSheet && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto"
            aria-label="Close sort"
            onClick={() => setShowSortSheet(false)}
          />
          <div className="relative w-full max-w-md mx-auto pointer-events-auto rounded-t-[1.75rem] md:rounded-3xl bg-white shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
            <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Sort by</h3>
            <div className="space-y-1.5">
              {(
                [
                  ['popular', 'Most popular'],
                  ['price_low', 'Price: Low to high'],
                  ['price_high', 'Price: High to low'],
                  ['newest', 'Newest first'],
                  ['rating', 'Highest rated'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSortBy(id);
                    setShowSortSheet(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                    sortBy === id
                      ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                      : 'bg-slate-50 text-slate-700 active:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Price filter sheet */}
      {showFilters && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />
          <div className="relative w-full max-w-md mx-auto pointer-events-auto rounded-t-[1.75rem] md:rounded-3xl bg-white shadow-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
            <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Price range</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                [
                  { min: 0, max: 10000, label: 'Any' },
                  { min: 0, max: 500, label: 'Under ₹500' },
                  { min: 500, max: 2000, label: '₹500 – ₹2,000' },
                  { min: 2000, max: 10000, label: 'Above ₹2,000' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPriceRange([preset.min, preset.max]);
                  }}
                  className={`px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                    priceRange[0] === preset.min && priceRange[1] === preset.max
                      ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Cart — bottom sheet (app-style) */}
      {showCart && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close cart"
            onClick={() => setShowCart(false)}
          />
          <div className="relative w-full max-h-[min(88dvh,36rem)] rounded-t-[1.75rem] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="pt-2 pb-1 flex justify-center md:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="px-4 pt-2 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your cart</h2>
                <p className="text-xs text-slate-500">{cartItemCount} items</p>
              </div>
              <button type="button" onClick={() => setShowCart(false)} className="p-2 rounded-xl bg-slate-50 active:bg-slate-100">
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
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex gap-3 p-3 bg-slate-50 rounded-2xl">
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
                <div className="p-4 pt-3 border-t border-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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

              {checkoutStep === 'payment' && !showPaymentPage && (
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
                    <label
                      onClick={() => router.push('/checkout')}
                      className="flex items-center gap-4 p-4 border-2 border-orange-500 rounded-xl cursor-pointer bg-orange-50 hover:bg-orange-100 transition"
                    >
                      <input type="radio" name="payment" className="w-5 h-5 text-orange-500" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Online Payment</p>
                        <p className="text-sm text-slate-500">Pay with UPI, Cards, Net Banking via Razorpay</p>
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
                      Review Order (COD)
                    </button>
                  </div>
                </div>
              )}

              {/* Universal Payment Page */}
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
                  onBack={() => setShowPaymentPage(false)}
                  onSuccess={handlePaymentSuccess}
                />
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
                          Place Order (COD)
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (!address.name || !address.phone || !address.line1 || !address.city || !address.pincode) {
                          alert('Please fill in all address fields');
                          return;
                        }
                        setCheckoutStep('payment');
                        setShowPaymentPage(true);
                      }}
                      disabled={processing}
                      className="w-full mt-2 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
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
      )}
    </div>
  );
}

// ============================================================================
// PRODUCT CARD COMPONENT
// ============================================================================

function ProductCard({ product, onAddToCart, inCart }: { product: Product; onAddToCart: () => void; inCart: boolean }) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const wishlistPid = canonicalProductId(product as unknown as Record<string, unknown>) || product.id;
  const primaryImage =
    product.images?.length && product.images[0] && !imageFailed ? String(product.images[0]).trim() : '';

  React.useEffect(() => {
    setImageFailed(false);
  }, [product.id, product.images?.[0]]);

  const handleCardClick = () => {
    window.location.href = `/shop/${wishlistPid}`;
  };

  const discount = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const outOfStock = product.stock === 0;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100/90 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-transform duration-150 group cursor-pointer min-w-0 w-full max-w-full flex flex-col h-full min-h-0 ${
        outOfStock ? 'opacity-90' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Image — compact 1:1 so the grid doesn’t feel stretched on mobile */}
      <div
        className={`relative aspect-square w-full shrink-0 bg-gradient-to-b from-slate-100 to-slate-50 overflow-hidden ${
          outOfStock ? 'grayscale-[0.35]' : ''
        }`}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl select-none">
            {product.emoji || '📦'}
          </div>
        )}

        <WishlistProductHeartButton
          productId={wishlistPid}
          visualVariant="shop-floating"
          className="absolute top-2 right-2 w-8 h-8"
        />

        {discount > 0 && !outOfStock && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md shadow-sm">
            {discount}% off
          </div>
        )}

        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-md">
            {product.stock} left
          </div>
        )}

        {outOfStock && (
          <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none z-[1]">
            <span className="px-2.5 py-1 rounded-full bg-slate-900/85 text-white text-[10px] font-bold tracking-wide backdrop-blur-sm">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 p-2.5 pt-2 gap-1">
        <p className="text-[10px] text-orange-600 font-semibold flex items-center gap-1 truncate leading-tight">
          <Store className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{product.vendor_name || 'Warmpawz Store'}</span>
        </p>

        <h3 className="font-semibold text-slate-900 text-xs leading-snug line-clamp-2">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 min-h-[16px]">
          {(product.review_count ?? 0) > 0 && (product.rating ?? 0) > 0 ? (
            <>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                {Number(product.rating).toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-400">({product.review_count})</span>
            </>
          ) : (
            <span className="text-[11px] text-slate-400">No reviews yet</span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-slate-900 tabular-nums">₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-[10px] text-slate-400 line-through tabular-nums">₹{product.original_price}</span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart();
          }}
          disabled={outOfStock}
          className={`mt-auto w-full py-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
            outOfStock
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : inCart
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 active:opacity-90'
          }`}
        >
          {outOfStock ? (
            'Unavailable'
          ) : inCart ? (
            <>
              <Check className="w-3.5 h-3.5" />
              In cart
            </>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}
