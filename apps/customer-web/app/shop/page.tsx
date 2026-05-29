'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { ShopCartSheet } from '@/components/shop/ShopCartSheet';
import { ShopCatalogSection } from '@/components/shop/ShopCatalogSection';
import { ShopCategoryScroller } from '@/components/shop/ShopCategoryScroller';
import { ShopCheckoutModal } from '@/components/shop/ShopCheckoutModal';
import { ShopDeliveryBar } from '@/components/shop/ShopDeliveryBar';
import { ShopHeroCarousel } from '@/components/shop/ShopHeroCarousel';
import { ShopPageHeader } from '@/components/shop/ShopPageHeader';
import { ShopSearchBar } from '@/components/shop/ShopSearchBar';
import { ShopSortFilterSheets } from '@/components/shop/ShopSortFilterSheets';
import { ShopTopDealsSection } from '@/components/shop/ShopTopDealsSection';
import { ShopTrustRow } from '@/components/shop/ShopTrustRow';
import { mapApiProductsList, sortShopProducts } from '@/components/shop/map-shop-product';
import type { ShopCartItem, ShopCategory, ShopCoupon, ShopProduct } from '@/components/shop/shop-types';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { handleShopPageBack } from '@/lib/go-back-or-replace';
import { emitWarmpawzCartUpdated, WARMPAWZ_CART_KEY } from '@/lib/warmpawz-cart-storage';

/** Full-viewport column — same width token as home + BottomNavigation (no grey outer frame). */
const SHOP_PAGE_SHELL =
  'relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-customer mx-auto flex-col overflow-hidden bg-white';

function scrollToCatalog() {
  document.getElementById('shop-all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function ShopPage() {
  const router = useRouter();
  const { accountSidebar, handleTabbedBottomNav, openAccountMenu } = useCustomerAccountSidebarHost();

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [cart, setCart] = useState<ShopCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);

  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'address' | 'payment' | 'confirm'>('address');
  const [processing, setProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [deliveryLabel, setDeliveryLabel] = useState('Deliver to: Add delivery address');

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ShopCoupon | null>(null);

  const [address, setAddress] = useState({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cat = new URLSearchParams(window.location.search).get('category');
    if (cat) setSelectedCategory(cat);
  }, []);

  const loadCustomerData = useCallback(() => {
    if (typeof window === 'undefined') return;
    const phone =
      localStorage.getItem('customer_phone') ||
      sessionStorage.getItem('customer_phone') ||
      localStorage.getItem('customerPhone') ||
      localStorage.getItem('phone') ||
      sessionStorage.getItem('phone') ||
      '';
    setCustomerPhone(phone);
    setCustomerId(getResolvedCustomerId() || undefined);
  }, []);

  const loadDeliveryAddress = useCallback(async (phone: string) => {
    if (!phone) {
      setDeliveryLabel('Deliver to: Add delivery address');
      return;
    }
    try {
      const res = (await apiClient
        .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
        .catch(() => null)) as { addresses?: Array<Record<string, unknown>> } | null;
      const addresses = res?.addresses || [];
      const defaultAddress =
        addresses.find((a) => a.isDefault === true) || addresses[0];
      if (defaultAddress) {
        const area = String(
          defaultAddress.area || defaultAddress.locality || defaultAddress.addressLine1 || ''
        ).trim();
        const city = String(defaultAddress.city || '').trim();
        const label =
          area && city ? `${area}, ${city}` : city || area || 'Your address';
        setDeliveryLabel(`Deliver to: ${label}`);
      } else {
        setDeliveryLabel('Deliver to: Add delivery address');
      }
    } catch {
      setDeliveryLabel('Deliver to: Add delivery address');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy) params.append('sort', sortBy);

      const [productsRes, categoriesRes] = await Promise.all([
        apiClient.get<{ products?: unknown[] }>(`/ecommerce/products?${params.toString()}`),
        apiClient.get<{ categories?: ShopCategory[] }>('/ecommerce/categories'),
      ]);

      const rawList = productsRes?.products || [];
      setProducts(mapApiProductsList(rawList));
      setCategories(categoriesRes?.categories || []);
    } catch (err: unknown) {
      console.error('Error loading shop:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shop');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy]);

  const loadFeaturedDeals = useCallback(async () => {
    try {
      setFeaturedLoading(true);
      const res = await apiClient.get<{ products?: unknown[] }>(
        '/ecommerce/products?featured=true&limit=10'
      );
      const raw = res?.products || [];
      const mapped = mapApiProductsList(raw).filter(
        (p) => (p as ShopProduct & { is_featured?: boolean }).is_featured !== false
      );
      setFeaturedProducts(mapped.length > 0 ? mapped : mapApiProductsList(raw).slice(0, 10));
    } catch {
      setFeaturedProducts([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  const loadCart = useCallback(() => {
    if (typeof window === 'undefined') return;
    const savedCart = localStorage.getItem(WARMPAWZ_CART_KEY);
    if (!savedCart) return;
    try {
      setCart(JSON.parse(savedCart));
    } catch (e) {
      console.error('Error loading cart:', e);
    }
  }, []);

  useEffect(() => {
    loadCustomerData();
    loadCart();
  }, [loadCustomerData, loadCart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadFeaturedDeals();
  }, [loadFeaturedDeals]);

  useEffect(() => {
    if (customerPhone) loadDeliveryAddress(customerPhone);
  }, [customerPhone, loadDeliveryAddress]);

  const saveCart = (newCart: ShopCartItem[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WARMPAWZ_CART_KEY, JSON.stringify(newCart));
      emitWarmpawzCartUpdated();
    }
  };

  const addToCart = (product: ShopProduct) => {
    const existing = cart.find((item) => item.product_id === product.id);
    const newCart = existing
      ? cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...cart, { product_id: product.id, product, quantity: 1 }];
    saveCart(newCart);
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
    saveCart(cart.filter((item) => item.product_id !== productId));
  };

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? cartSubtotal * (appliedCoupon.discount_value / 100)
      : appliedCoupon.discount_value
    : 0;
  const shippingFee = cartSubtotal > 499 ? 0 : 49;
  const cartTotal = cartSubtotal - discountAmount + shippingFee;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartProductIds = useMemo(
    () => new Set(cart.map((item) => item.product_id)),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      return matchesSearch && matchesPrice;
    });
    return sortShopProducts(filtered, sortBy);
  }, [products, searchTerm, priceRange, sortBy]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const result = await apiClient.post<{ valid?: boolean; coupon?: ShopCoupon }>(
        '/ecommerce/validate-coupon',
        { code: couponCode, order_total: cartSubtotal }
      );
      if (result?.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponCode('');
      } else {
        alert('Invalid coupon code');
      }
    } catch (err) {
      console.error('Error applying coupon:', err);
      alert('Failed to apply coupon');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!address.name || !address.phone || !address.line1 || !address.city || !address.pincode) {
      alert('Please fill in all address fields');
      return;
    }
    if (!customerPhone && !address.phone) {
      alert('Please provide your phone number');
      return;
    }
    setShowPaymentPage(true);
  };

  const handlePaymentSuccess = async (_bookingId: string, orderId?: string) => {
    if (orderId) {
      saveCart([]);
      setAppliedCoupon(null);
      setShowCheckout(false);
      setShowPaymentPage(false);
      setCheckoutStep('address');
      alert(`Order placed successfully! Order ID: ${orderId}`);
    } else {
      alert('Payment successful but order ID not received. Please check your order history.');
    }
  };

  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className={SHOP_PAGE_SHELL}>
        <header className="px-5 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.5rem))] pb-3 border-b border-slate-100">
          <button
            type="button"
            onClick={() => handleShopPageBack(router)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/90"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-orange-50 flex items-center justify-center">
              <ShoppingCart className="w-10 h-10 text-[#FF8C42]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Shop coming soon</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We&apos;re preparing the Warmpawz marketplace for customers. Please check back later.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className={SHOP_PAGE_SHELL}>
        <header className="sticky top-0 z-40 shrink-0 bg-white/95 backdrop-blur-lg border-b border-slate-100">
          <div className="px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))] pb-2">
            <ShopPageHeader
              onBack={() => handleShopPageBack(router)}
              cartItemCount={cartItemCount}
              onOpenCart={() => setShowCart(true)}
            />
            <ShopSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onOpenFilters={() => setShowFilters(true)}
            />
            <ShopCategoryScroller
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-[var(--customer-tabbed-nav-offset)] [-webkit-overflow-scrolling:touch]">
          <ShopDeliveryBar
            deliveryLabel={deliveryLabel}
            onAddressClick={() => router.push('/settings')}
          />
          <ShopHeroCarousel />
          <ShopTrustRow />
          <ShopTopDealsSection
            products={featuredProducts}
            loading={featuredLoading}
            cartProductIds={cartProductIds}
            onAddToCart={addToCart}
            onViewAll={scrollToCatalog}
          />
          <ShopCatalogSection
            loading={loading}
            error={error}
            products={filteredProducts}
            cartProductIds={cartProductIds}
            sortBy={sortBy}
            cartSubtotal={cartSubtotal}
            onRetry={loadData}
            onAddToCart={addToCart}
            onOpenSort={() => setShowSortSheet(true)}
          />
        </main>

        <BottomNavigation
          currentScreen="shop"
          onNavigate={handleTabbedBottomNav}
          onProfileClick={openAccountMenu}
        />
        {accountSidebar}

        <ShopSortFilterSheets
          showSort={showSortSheet}
          showFilters={showFilters}
          sortBy={sortBy}
          priceRange={priceRange}
          onCloseSort={() => setShowSortSheet(false)}
          onCloseFilters={() => setShowFilters(false)}
          onSelectSort={(id) => {
            setSortBy(id);
            setShowSortSheet(false);
          }}
          onSelectPriceRange={setPriceRange}
        />

        <ShopCartSheet
          open={showCart}
          cart={cart}
          cartItemCount={cartItemCount}
          cartSubtotal={cartSubtotal}
          cartTotal={cartTotal}
          shippingFee={shippingFee}
          discountAmount={discountAmount}
          appliedCoupon={appliedCoupon}
          couponCode={couponCode}
          onClose={() => setShowCart(false)}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onCouponCodeChange={setCouponCode}
          onApplyCoupon={applyCoupon}
          onClearCoupon={() => setAppliedCoupon(null)}
          onProceedCheckout={() => {
            setShowCart(false);
            setShowCheckout(true);
          }}
        />
      </div>

      <ShopCheckoutModal
        open={showCheckout}
        cart={cart}
        cartItemCount={cartItemCount}
        cartSubtotal={cartSubtotal}
        cartTotal={cartTotal}
        shippingFee={shippingFee}
        discountAmount={discountAmount}
        checkoutStep={checkoutStep}
        showPaymentPage={showPaymentPage}
        processing={processing}
        address={address}
        customerPhone={customerPhone}
        customerId={customerId}
        onClose={() => setShowCheckout(false)}
        onAddressChange={setAddress}
        onCheckoutStepChange={setCheckoutStep}
        onShowPaymentPage={setShowPaymentPage}
        onPlaceOrder={handleCheckout}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}
