'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { ShopCatalogSection } from '@/components/shop/ShopCatalogSection';
import { ShopCategoryScroller } from '@/components/shop/ShopCategoryScroller';
import { ShopDeliveryBar } from '@/components/shop/ShopDeliveryBar';
import { CustomerPlacementBanners } from '@/components/customer/shared/CustomerPlacementBanners';
import { ShopPageHeader } from '@/components/shop/ShopPageHeader';
import { ShopFloatingCartBar } from '@/components/shop/ShopFloatingCartBar';
import { ShopSearchBar } from '@/components/shop/ShopSearchBar';
import { ShopSortFilterSheets } from '@/components/shop/ShopSortFilterSheets';
import { ShopTopDealsSection } from '@/components/shop/ShopTopDealsSection';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import { mapApiProductsList } from '@/components/shop/map-shop-product';
import type { ShopCartItem, ShopCategory, ShopProduct } from '@/components/shop/shop-types';
import { apiClient } from '@/lib/api-client';
import {
  filterShopCategoriesWithProducts,
  mapApiCategoriesToShop,
  resolveShopCategoryParam,
  SHOP_CATEGORIES_WITH_PRODUCTS_PATH,
} from '@/lib/shop-category-display';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { isShopUiVisibleForAccount, readStoredCustomerPhone } from '@/lib/app-review-demo-account';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { handleShopPageBack } from '@/lib/go-back-or-replace';
import { emitWarmpawzCartUpdated, CART_UPDATED_EVENT, WARMPAWZ_CART_KEY } from '@/lib/warmpawz-cart-storage';
import { cartLineKey } from '@/lib/product-sku-client';
import {
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
  type DeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import { formatDeliveryAddressLine } from '@/lib/ecommerce/delivery-address-display';
import {
  readCheckoutAddressId,
  writeCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import { WARMPAWZ_ACCOUNT_SIDEBAR_ACTIVE_VIEW_KEY } from '@/lib/go-back-or-replace';

/** Shop listing cart line: parent id, or parent::listingSku when product has variants. */
function shopListingLineId(product: ShopProduct): string {
  if (product.has_variants && product.listing_sku_id) {
    return cartLineKey(product.id, product.listing_sku_id);
  }
  return product.id;
}

function deliveryAddressToLabel(addr: DeliveryAddress): string {
  const area = (addr.addressLine1 || addr.street || '').trim();
  const city = (addr.city || '').trim();
  const short =
    area && city ? `${area}, ${city}` : formatDeliveryAddressLine(addr);
  return `Deliver to: ${short}`;
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

function setShopCategoryInUrl(categoryId: string) {
  if (typeof window === 'undefined' || !categoryId) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('category') === categoryId) return;
  url.searchParams.set('category', categoryId);
  window.history.replaceState({}, '', url.pathname + url.search);
}

/** Full-viewport column — same width token as home + BottomNavigation (no grey outer frame). */
const SHOP_PAGE_SHELL =
  'relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-customer mx-auto flex-col overflow-hidden bg-white';

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-slate-500">
          Loading shop...
        </div>
      }
    >
      <ShopPageContent />
    </Suspense>
  );
}

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category') ?? '';
  const nav = useCustomerNavigation();
  const { accountSidebar, handleTabbedBottomNav, openAccountMenu } = useCustomerAccountSidebarHost();

  /** Must match SHOP_DEFAULT_LIMIT on the backend. */
  const SHOP_PAGE_SIZE = 10;

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [cart, setCart] = useState<ShopCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('category') || '';
  });
  const [sortBy, setSortBy] = useState('popular');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryLabel, setDeliveryLabel] = useState('Deliver to: Add delivery address');
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressPickerLoading, setAddressPickerLoading] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [categoriesReady, setCategoriesReady] = useState(false);

  const selectedDeliveryAddressRef = useRef<DeliveryAddress | null>(null);
  const loadProductsGenRef = useRef(0);
  /** Last ?category= value applied from Next searchParams (skip chip/local changes). */
  const lastAppliedUrlCategoryRef = useRef<string | null>(null);
  /** UUID after slug resolve — used to ignore stale slug still held by useSearchParams. */
  const resolvedCategoryRef = useRef<string>('');

  const applyCategorySelection = useCallback((categoryId: string) => {
    resolvedCategoryRef.current = categoryId;
    setSelectedCategory(categoryId);
    if (categoryId) setShopCategoryInUrl(categoryId);
    else clearShopCategoryFromUrl();
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
  }, []);

  const applySelectedDeliveryAddress = useCallback((addr: DeliveryAddress) => {
      selectedDeliveryAddressRef.current = addr;
      setSelectedDeliveryAddress(addr);
      setDeliveryLabel(deliveryAddressToLabel(addr));
      if (addr.id) {
        writeCheckoutAddressId(addr.id);
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
          applySelectedDeliveryAddress(match);
          return list;
        }
      }

      let next = pickDefaultDeliveryAddress(list);
      if (typeof window !== 'undefined') {
        const savedId = readCheckoutAddressId();
        if (savedId) {
          const match = list.find((a) => a.id === savedId);
          if (match) next = match;
        }
      }

      if (next) {
        applySelectedDeliveryAddress(next);
      } else {
        selectedDeliveryAddressRef.current = null;
        setSelectedDeliveryAddress(null);
        setDeliveryLabel('Deliver to: Add delivery address');
      }

      return list;
    },
    [applySelectedDeliveryAddress]
  );

  /** Debounce searchTerm → debouncedSearch (300 ms). API calls use debouncedSearch. */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  /**
   * Apply ?category= only when the Next.js search param actually changes
   * (e.g. home tile navigation while /shop is mounted). Chip clicks update state
   * via applyCategorySelection and must not be overwritten by a stale param.
   */
  useEffect(() => {
    if (lastAppliedUrlCategoryRef.current === categoryFromUrl) return;
    lastAppliedUrlCategoryRef.current = categoryFromUrl;

    if (
      resolvedCategoryRef.current &&
      categoryFromUrl &&
      (categoryFromUrl === resolvedCategoryRef.current ||
        resolveShopCategoryParam(categoryFromUrl, categories) === resolvedCategoryRef.current)
    ) {
      return;
    }

    setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl, categories]);

  /**
   * Load storefront category chips once per mount (categories that have products).
   */
  const loadCategories = useCallback(async () => {
    const categoriesRes = await apiClient.get<{ categories?: Array<Record<string, unknown>> }>(
      SHOP_CATEGORIES_WITH_PRODUCTS_PATH
    );
    const rawCategories = categoriesRes?.categories;
    const mapped = filterShopCategoriesWithProducts(
      mapApiCategoriesToShop(
        Array.isArray(rawCategories)
          ? rawCategories.map((c) => (c && typeof c === 'object' ? c : {}) as Record<string, unknown>)
          : []
      )
    );
    setCategories(mapped);
    setCategoriesReady(true);
    return mapped;
  }, []);

  /**
   * Fetch one page of products and either replace (reset=true) or append (reset=false).
   */
  const loadProducts = useCallback(
    async (reset: boolean, currentOffset: number, currentCategory: string) => {
      const gen = ++loadProductsGenRef.current;

      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const effectiveCategory = currentCategory;

        const params = new URLSearchParams();
        if (effectiveCategory) params.set('category', effectiveCategory);
        params.set('sort', sortBy);
        params.set('limit', String(SHOP_PAGE_SIZE));
        params.set('offset', String(currentOffset));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (priceRange[0] > 0) params.set('min_price', String(priceRange[0]));
        if (priceRange[1] < 10000) params.set('max_price', String(priceRange[1]));

        const productsRes = await apiClient.get<{
          products?: unknown[];
          hasMore?: boolean;
          total?: number;
        }>(`/ecommerce/products?${params.toString()}`);

        const rawList = productsRes?.products || [];
        const newProducts = mapApiProductsList(rawList);
        const more = productsRes?.hasMore ?? newProducts.length >= SHOP_PAGE_SIZE;

        if (gen !== loadProductsGenRef.current) return;

        if (reset) {
          setProducts(newProducts);
          setOffset(newProducts.length);
        } else {
          setProducts((prev) => [...prev, ...newProducts]);
          setOffset((prev) => prev + newProducts.length);
        }
        setHasMore(more);
      } catch (err: unknown) {
        console.error('Error loading shop:', err);
        if (gen !== loadProductsGenRef.current) return;
        if (reset) setError(err instanceof Error ? err.message : 'Failed to load shop');
      } finally {
        if (gen !== loadProductsGenRef.current) return;
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, debouncedSearch, priceRange, SHOP_PAGE_SIZE],
  );

  const loadMoreProducts = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    void loadProducts(false, offset, selectedCategory);
  }, [hasMore, loadingMore, loading, loadProducts, offset, selectedCategory]);

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
    if (typeof window === 'undefined') return;
    const sync = () => loadCart();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync);
  }, [loadCart]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mapped = await loadCategories();
        if (cancelled) return;
        const fromUrl = categoryFromUrl || selectedCategory;
        if (!fromUrl) return;
        const resolved = resolveShopCategoryParam(fromUrl, mapped);
        if (resolved) {
          resolvedCategoryRef.current = resolved;
          setSelectedCategory(resolved);
          setShopCategoryInUrl(resolved);
        } else {
          resolvedCategoryRef.current = '';
          setSelectedCategory('');
          clearShopCategoryFromUrl();
        }
      } catch (err) {
        console.error('Error loading shop categories:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCategories]);

  /** Reset and reload products when filters/sort/search/category change (after categories ready). */
  useEffect(() => {
    if (!categoriesReady) return;
    void loadProducts(true, 0, selectedCategory);
  }, [categoriesReady, selectedCategory, sortBy, debouncedSearch, priceRange, loadProducts]);

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
      nav.goToAuth();
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
    applySelectedDeliveryAddress(addr);
  };

  const handleAddAddressSuccess = async (newAddress: DeliveryAddress) => {
    setShowAddAddressModal(false);
    const list = await refreshDeliveryAddresses(customerPhone, { preserveSelection: false });
    const match =
      list.find((a) => a.id && newAddress?.id && a.id === newAddress.id) ??
      pickDefaultDeliveryAddress(list);
    if (match) applySelectedDeliveryAddress(match);
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

  const updateProductQuantity = (product: ShopProduct, quantity: number) => {
    const lineId = shopListingLineId(product);
    const nextQty = Math.max(0, Math.floor(quantity));
    const existing = cart.find((item) => item.product_id === lineId);
    if (nextQty <= 0) {
      if (existing) saveCart(cart.filter((item) => item.product_id !== lineId));
      return;
    }
    const capped = product.stock > 0 ? Math.min(nextQty, product.stock) : nextQty;
    const skuId =
      product.has_variants && product.listing_sku_id
        ? product.listing_sku_id
        : undefined;
    const selectedVariations =
      skuId &&
      product.listing_option_values &&
      Object.keys(product.listing_option_values).length > 0
        ? product.listing_option_values
        : undefined;
    const newCart = existing
      ? cart.map((item) =>
          item.product_id === lineId
            ? {
                ...item,
                quantity: capped,
                product,
                product_sku_id: skuId ?? item.product_sku_id,
                selected_variations: selectedVariations ?? item.selected_variations,
              }
            : item
        )
      : [
          ...cart,
          {
            product_id: lineId,
            product,
            quantity: capped,
            product_sku_id: skuId,
            selected_variations: selectedVariations,
          },
        ];
    saveCart(newCart);
  };

  const addToCart = (product: ShopProduct) => {
    // Variant products need a SKU. Prefer the API listing SKU (lowest in-stock price);
    // only open PDP when we cannot resolve one.
    if (product.has_variants && !product.listing_sku_id) {
      nav.goToProduct(product.id);
      return;
    }
    const lineId = shopListingLineId(product);
    updateProductQuantity(
      product,
      (cart.find((item) => item.product_id === lineId)?.quantity ?? 0) + 1
    );
  };

  const getCartQuantity = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId)
        ?? featuredProducts.find((p) => p.id === productId);
      const lineId = product ? shopListingLineId(product) : productId;
      return cart.find((item) => item.product_id === lineId)?.quantity ?? 0;
    },
    [cart, products, featuredProducts]
  );

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Search, sort, and price filtering are now server-side.
  // `products` is the final list to render; no client-side filter step.

  if (typeof window !== 'undefined' && !isShopUiVisibleForAccount(readStoredCustomerPhone())) {
    return <AppReviewDemoRouteGuard>{null}</AppReviewDemoRouteGuard>;
  }

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
            <ShopPageHeader onBack={() => handleShopPageBack(router)} />
            <ShopSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortBy={sortBy}
              hasActivePriceFilter={priceRange[0] > 0 || priceRange[1] < 10000}
              onOpenFilters={() => setShowFilterSheet(true)}
            />
            <ShopCategoryScroller
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={applyCategorySelection}
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
          />
          <ShopTopDealsSection
            products={featuredProducts}
            loading={featuredLoading}
            getCartQuantity={getCartQuantity}
            onAddToCart={addToCart}
            onQuantityChange={updateProductQuantity}
            onViewAll={scrollToCatalog}
          />
          <ShopCatalogSection
            loading={loading}
            error={error}
            products={products}
            getCartQuantity={getCartQuantity}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onRetry={() => void loadProducts(true, 0, selectedCategory)}
            onAddToCart={addToCart}
            onQuantityChange={updateProductQuantity}
            onLoadMore={loadMoreProducts}
          />
        </main>

        <ShopFloatingCartBar cart={cart} itemCount={cartItemCount} />

        <BottomNavigation
          currentScreen="shop"
          onNavigate={handleTabbedBottomNav}
          onProfileClick={openAccountMenu}
        />
        {accountSidebar}

        <ShopSortFilterSheets
          open={showFilterSheet}
          sortBy={sortBy}
          priceRange={priceRange}
          onClose={() => setShowFilterSheet(false)}
          onSelectSort={(id) => {
            setSortBy(id);
            setShowFilterSheet(false);
          }}
          onSelectPriceRange={setPriceRange}
        />

      </div>

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
