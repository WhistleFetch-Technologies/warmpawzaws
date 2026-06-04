'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { ShopCartSheet } from '@/components/shop/ShopCartSheet';
import { ShopCatalogSection } from '@/components/shop/ShopCatalogSection';
import { ShopCategoryScroller } from '@/components/shop/ShopCategoryScroller';
import { ShopCheckoutModal } from '@/components/shop/ShopCheckoutModal';
import { ShopDeliveryBar } from '@/components/shop/ShopDeliveryBar';
import { ShopHeroCarousel } from '@/components/shop/ShopHeroCarousel';
import { CustomerPlacementBanners } from '@/components/customer/shared/CustomerPlacementBanners';
import { ShopPageHeader } from '@/components/shop/ShopPageHeader';
import { ShopSearchBar } from '@/components/shop/ShopSearchBar';
import { ShopSortFilterSheets } from '@/components/shop/ShopSortFilterSheets';
import { ShopTopDealsSection } from '@/components/shop/ShopTopDealsSection';
import { ShopTrustRow } from '@/components/shop/ShopTrustRow';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import { mapApiProductsList, sortShopProducts } from '@/components/shop/map-shop-product';
import type { ShopCartItem, ShopCategory, ShopCoupon, ShopProduct } from '@/components/shop/shop-types';
import { apiClient } from '@/lib/api-client';
import { mapApiCategoriesToShop } from '@/lib/shop-category-display';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { handleShopPageBack } from '@/lib/go-back-or-replace';
import { emitWarmpawzCartUpdated, WARMPAWZ_CART_KEY } from '@/lib/warmpawz-cart-storage';
import {
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import { formatDeliveryAddressLine } from '@/lib/ecommerce/delivery-address-display';
import { WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY } from '@/lib/go-back-or-replace';

/** Full-viewport column — same width token as home + BottomNavigation (no grey outer frame). */
const SHOP_PAGE_SHELL =
  'relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-customer mx-auto flex-col overflow-hidden bg-white';

const SHOP_DELIVERY_ADDRESS_ID_KEY = 'warmpawz_shop_delivery_address_id';

function deliveryAddressToLabel(addr: DeliveryAddress): string {
  const area = (addr.addressLine1 || addr.street || '').trim();
  const city = (addr.city || '').trim();
  const short =
    area && city ? `${area}, ${city}` : formatDeliveryAddressLine(addr);
  return `Deliver to: ${short}`;
}

function deliveryAddressToShopAddress(addr: DeliveryAddress, phone: string) {
  return {
    name: addr.fullName || addr.name || '',
    phone: addr.phone || phone,
    line1: addr.addressLine1 || addr.street || '',
    line2: addr.addressLine2 || '',
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || '',
  };
}

function scrollToCatalog() {
  document.getElementById('shop-all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearShopCategoryFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('category')) return;
  url.searchParams.delete('category');
  const next = url.pathname + (url.search ? url.search : '');
  window.history.replaceState({}, '', next);
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
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressPickerLoading, setAddressPickerLoading] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);

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

  const selectedDeliveryAddressRef = useRef<DeliveryAddress | null>(null);

  const applySelectedDeliveryAddress = useCallback(
    (addr: DeliveryAddress, phone: string) => {
      selectedDeliveryAddressRef.current = addr;
      setSelectedDeliveryAddress(addr);
      setDeliveryLabel(deliveryAddressToLabel(addr));
      setAddress(deliveryAddressToShopAddress(addr, phone));
      if (typeof window !== 'undefined' && addr.id) {
        localStorage.setItem(SHOP_DELIVERY_ADDRESS_ID_KEY, addr.id);
      }
    },
    []
  );

  const refreshDeliveryAddresses = useCallback(
    async (phone: string, opts?: { preserveSelection?: boolean }) => {
      const list = await loadCustomerDeliveryAddresses(phone);
      setSavedAddresses(list);

      if (opts?.preserveSelection && selectedDeliveryAddressRef.current?.id) {
        const match = list.find((a) => a.id === selectedDeliveryAddressRef.current?.id);
        if (match) {
          applySelectedDeliveryAddress(match, phone);
          return list;
        }
      }

      let next = pickDefaultDeliveryAddress(list);
      if (typeof window !== 'undefined') {
        const savedId = localStorage.getItem(SHOP_DELIVERY_ADDRESS_ID_KEY);
        if (savedId) {
          const match = list.find((a) => a.id === savedId);
          if (match) next = match;
        }
      }

      if (next) {
        applySelectedDeliveryAddress(next, phone);
      } else {
        selectedDeliveryAddressRef.current = null;
        setSelectedDeliveryAddress(null);
        setDeliveryLabel('Deliver to: Add delivery address');
      }

      return list;
    },
    [applySelectedDeliveryAddress]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const categoriesRes = await apiClient.get<{ categories?: Array<Record<string, unknown>> }>(
        '/ecommerce/categories'
      );
      const rawCategories = categoriesRes?.categories;
      const mappedCategories = mapApiCategoriesToShop(
        Array.isArray(rawCategories)
          ? rawCategories.map((c) => (c && typeof c === 'object' ? c : {}) as Record<string, unknown>)
          : []
      );
      setCategories(mappedCategories);

      let effectiveCategory = selectedCategory;
      if (
        effectiveCategory &&
        !mappedCategories.some((c) => c.id === effectiveCategory)
      ) {
        effectiveCategory = '';
        setSelectedCategory('');
        clearShopCategoryFromUrl();
      }

      const params = new URLSearchParams();
      if (effectiveCategory) params.append('category', effectiveCategory);
      if (sortBy) params.append('sort', sortBy);

      const productsRes = await apiClient.get<{ products?: unknown[] }>(
        `/ecommerce/products?${params.toString()}`
      );

      const rawList = productsRes?.products || [];
      setProducts(mapApiProductsList(rawList));
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
    if (!customerPhone) {
      setDeliveryLabel('Deliver to: Add delivery address');
      return;
    }
    refreshDeliveryAddresses(customerPhone).catch(() => {
      setDeliveryLabel('Deliver to: Add delivery address');
    });
  }, [customerPhone, refreshDeliveryAddresses]);

  const openAddressPicker = async () => {
    if (!customerPhone) {
      router.push('/auth');
      return;
    }
    setShowAddressPicker(true);
    setAddressPickerLoading(true);
    try {
      await refreshDeliveryAddresses(customerPhone, { preserveSelection: true });
    } catch {
      setSavedAddresses([]);
    } finally {
      setAddressPickerLoading(false);
    }
  };

  const handleAddressSelect = (addr: DeliveryAddress) => {
    applySelectedDeliveryAddress(addr, customerPhone);
  };

  const handleAddAddressSuccess = async (newAddress: DeliveryAddress) => {
    setShowAddAddressModal(false);
    const list = await refreshDeliveryAddresses(customerPhone, { preserveSelection: false });
    const match =
      list.find((a) => a.id && newAddress?.id && a.id === newAddress.id) ??
      pickDefaultDeliveryAddress(list);
    if (match) applySelectedDeliveryAddress(match, customerPhone);
  };

  const handleManageAddresses = () => {
    try {
      sessionStorage.setItem(WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY, 'addresses');
    } catch {
      /* ignore */
    }
    openAccountMenu();
  };

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
          <div className="px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))] pb-1">
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
            onAddressClick={openAddressPicker}
          />
          <CustomerPlacementBanners
            placement="shop"
            className="px-4 mt-3 mb-1"
            shellClassName="h-36"
            fallback={<ShopHeroCarousel embedded />}
          />
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
            router.push('/cart');
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

      <DeliveryAddressPickerSheet
        open={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        addresses={savedAddresses}
        selectedAddress={selectedDeliveryAddress}
        onSelect={handleAddressSelect}
        onAddNew={() => {
          setShowAddressPicker(false);
          setShowAddAddressModal(true);
        }}
        onManageAddresses={handleManageAddresses}
        loading={addressPickerLoading}
        phone={customerPhone}
      />

      <AddAddressModal
        phone={customerPhone}
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSuccess={handleAddAddressSuccess}
        customerName={selectedDeliveryAddress?.fullName || selectedDeliveryAddress?.name || ''}
      />
    </>
  );
}
