'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { resolveShopProductIdFromLocation } from '@/lib/resolve-shop-product-id';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { useDeepLinkBackStack } from '@/lib/navigation/use-deep-link-back-stack';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import {
  mergeLineIntoWarmpawzCartStorage,
  setLineQuantityInWarmpawzCartStorage,
  readWarmpawzCartLines,
  CART_UPDATED_EVENT,
} from '@/lib/warmpawz-cart-storage';
import type { WarmpawzCartProductSnapshot } from '@/lib/warmpawz-cart-storage';
import { WishlistProductHeartButton } from '@/components/customer/WishlistProductHeartButton';
import { SellerProductPromotions } from '@/components/customer/ecommerce/SellerProductPromotions';
import { formatAverageForDisplay, formatRatingNumberOrDash } from '@/lib/rating-display';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import {
  getProductDiscountPercent,
  listPriceForDiscountDisplay,
  resolveProductCompareAtPrice,
  resolveProductSellingPrice,
} from '@/lib/shop-product-pricing';
import {
  type ClientProductSku,
  resolveSkuFromSelection,
  resolveSkuPriceForSelection,
  skuImages,
  cartLineKey,
  getDefaultProductSku,
  optionValuesToSelectedVariations,
  parseClientSkuPrice,
  variationSelectionKey,
} from '@/lib/product-sku-client';
import {
  readCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import {
  loadCustomerDeliveryAddresses,
  pickDefaultDeliveryAddress,
} from '@/lib/ecommerce/load-customer-addresses';
import {
  deliveryBlockMessage,
  deliveryRegionsLabel,
  isProductDeliverableToCity,
  normalizeDeliveryRegionsList,
} from '@/lib/ecommerce/product-delivery-guard';
import {
  ArrowLeft, ShoppingCart, Star, Truck, Shield, Tag,
  Package, Store, Check, Plus, Minus, Share2, ChevronRight,
  Clock, ThumbsUp, User, AlertCircle, RefreshCcw
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  category_name?: string;
  price: number;
  original_price?: number;
  images: string[];
  emoji?: string;
  rating: number;
  review_count: number;
  stock: number;
  vendor_id: string;
  vendor_name: string;
  brand?: string;
  material?: string;
  dimensions?: { length: number; width: number; height: number; weight: number };
  variations?: ProductVariation[];
  specifications?: Record<string, string>;
  is_active: boolean;
  delivery_regions?: string[];
}

interface ProductVariation {
  id: string;
  name: string;
  type: 'color' | 'size' | 'weight' | 'other';
  option_key?: string;
  options: { value: string; price?: number; price_modifier?: number; stock?: number; image?: string }[];
}

interface Review {
  id: string;
  customer_id: string;
  customer_name: string;
  rating: number;
  title?: string;
  content: string;
  helpful_count: number;
  created_at: string;
  verified_purchase: boolean;
}

interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  selected_variations?: Record<string, string>;
}

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  emoji?: string;
  rating: number;
  vendor_name: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const o = item as Record<string, unknown>;
          return String(o.url ?? o.src ?? o.image_url ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return ensureImageUrls(parsed);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

function displaySpecValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mapRecommendedProduct(row: Record<string, unknown>): RecommendedProduct | null {
  const id = String(row.id ?? '').trim();
  if (!id) return null;
  const priceRaw = row.price ?? row.unit_price;
  const price = priceRaw != null ? parseFloat(String(priceRaw)) : 0;
  const originalRaw =
    row.original_price ?? row.compare_at_price ?? row.compareAtPrice ?? row.mrp;
  const original_price =
    originalRaw != null && Number.isFinite(parseFloat(String(originalRaw)))
      ? parseFloat(String(originalRaw))
      : undefined;
  const vendor_name = String(
    row.vendor_name ?? row.vendorName ?? row.business_name ?? 'Seller',
  );
  const rating = Number(row.rating ?? row.review_count) || 0;
  return {
    id,
    name: String(row.name ?? 'Product'),
    price: Number.isFinite(price) ? price : 0,
    original_price,
    rating,
    vendor_name,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductDetailClient() {
  const params = useParams();
  const router = useRouter();
  const nav = useCustomerNavigation();
  useDeepLinkBackStack();
  const productId = resolveShopProductIdFromLocation(params.productId as string);

  const [product, setProduct] = useState<Product | null>(null);
  const [productSkus, setProductSkus] = useState<ClientProductSku[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [alsoBought, setAlsoBought] = useState<RecommendedProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [showReviews, setShowReviews] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [customerCity, setCustomerCity] = useState<string | null>(null);
  const userTouchedVariationsRef = useRef(false);
  const defaultVariationsAppliedRef = useRef(false);

  const wishlistProductId = useMemo(() => {
    if (product) {
      const c = canonicalProductId(product as unknown as Record<string, unknown>);
      return (c || productId || '').trim();
    }
    return (productId || '').trim();
  }, [product, productId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCity() {
      if (typeof window === 'undefined') return;
      const phone =
        localStorage.getItem('customerPhone') ||
        localStorage.getItem('customer_phone') ||
        '';
      if (!phone) return;
      try {
        const list = await loadCustomerDeliveryAddresses(phone);
        const storedId = readCheckoutAddressId();
        let picked = storedId ? list.find((a) => a.id === storedId) : null;
        if (!picked) picked = pickDefaultDeliveryAddress(list);
        if (!cancelled && picked?.city) {
          setCustomerCity(String(picked.city).trim());
        }
      } catch {
        /* ignore address load errors on PDP */
      }
    }
    void loadCity();
    return () => {
      cancelled = true;
    };
  }, []);

  const deliveryRegions = useMemo(
    () => normalizeDeliveryRegionsList(product?.delivery_regions),
    [product?.delivery_regions],
  );

  const canDeliverToCustomer = useMemo(
    () => isProductDeliverableToCity(deliveryRegions, customerCity),
    [deliveryRegions, customerCity],
  );

  const deliveryMessage = useMemo(() => {
    if (deliveryRegions.length === 0) return deliveryRegionsLabel([]);
    if (customerCity && !canDeliverToCustomer) {
      return deliveryBlockMessage(
        product?.name ?? 'This product',
        customerCity,
        deliveryRegions,
      );
    }
    return deliveryRegionsLabel(deliveryRegions);
  }, [deliveryRegions, customerCity, canDeliverToCustomer, product?.name]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setError('Product not found');
      return;
    }
    loadProductData();
    recordProductView();
  }, [productId]);

  const loadProductData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[shop/product] load detail', {
        routeParamProductId: productId,
        fetchPathPrimary: `/ecommerce/products/${productId}`,
      });

      let productRes: any;
      try {
        productRes = await apiClient.get<any>(`/ecommerce/products/${productId}`);
      } catch (firstErr: any) {
        const is404 =
          firstErr?.status === 404 ||
          firstErr?.statusCode === 404 ||
          String(firstErr?.message || '').includes('404');
        if (is404) {
          console.warn('[shop/product] ecommerce detail 404, retrying /products/:id', {
            productId,
          });
          productRes = await apiClient.get<any>(`/products/${productId}`);
        } else {
          throw firstErr;
        }
      }

      const [reviewsRes, alsoBoughtRes, similarRes] = await Promise.all([
        apiClient.get<any>(`/products/${productId}/reviews`).catch(() => ({ reviews: [] })),
        apiClient.get<any>(`/products/${productId}/also-bought`).catch(() => ({ products: [] })),
        apiClient
          .get<any>(`/ads-recommendations/products/${productId}/similar?limit=4`)
          .catch(() => ({ products: [] })),
      ]);

      if (productRes?.product) {
        const p = productRes.product;
        const resolvedId = canonicalProductId(p) || productId;
        console.log('[shop/product] detail ok', {
          routeParamProductId: productId,
          resolvedProductId: resolvedId,
          rowKeys: p && typeof p === 'object' ? Object.keys(p) : [],
        });
        const compareOrOriginal = p.original_price ?? p.compare_at_price;
        const rc = Number(p.review_count ?? 0) || 0;
        const rawRating = p.rating != null ? Number(p.rating) : NaN;
        const rating =
          rc > 0 && Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0;
        const parsedProductPrice = parseFloat(String(p.price ?? '')) || 0;
        setProduct({
          ...p,
          id: resolvedId,
          description:
            typeof p.description === 'string'
              ? p.description
              : p.description != null
                ? displaySpecValue(p.description)
                : '',
          stock: p.stock_quantity || p.stock || 0,
          price: parsedProductPrice,
          original_price:
            compareOrOriginal != null && String(compareOrOriginal) !== ''
              ? parseFloat(String(compareOrOriginal))
              : undefined,
          rating,
          review_count: rc,
          images: ensureImageUrls(p.images),
          emoji: p.emoji || '🐾',
          variations: Array.isArray(p.variations) ? p.variations : [],
          specifications:
            p.specifications != null &&
            typeof p.specifications === 'object' &&
            !Array.isArray(p.specifications)
              ? (p.specifications as Record<string, unknown>)
              : undefined,
          default_option_values: p.default_option_values,
        });
        const skusFromApi = (
          (productRes?.skus ??
            p.skus ??
            []) as ClientProductSku[]
        );
        const variationList = Array.isArray(p.variations) ? p.variations : [];
        setProductSkus(
          skusFromApi
            .filter((s) => s.id != null && UUID_RE.test(String(s.id)))
            .map((s) => ({
              ...s,
              id: String(s.id),
              price: parseClientSkuPrice(s.price, parsedProductPrice),
              compare_at_price:
                s.compare_at_price != null ? parseClientSkuPrice(s.compare_at_price) : null,
              stock: Number(s.stock) || 0,
              images: ensureImageUrls(s.images),
              sort_order:
                s.sort_order != null && Number.isFinite(Number(s.sort_order))
                  ? Number(s.sort_order)
                  : undefined,
            })),
        );
        defaultVariationsAppliedRef.current = false;
        if (!userTouchedVariationsRef.current) {
          const fromProduct = p.default_option_values as Record<string, unknown> | undefined;
          const defaultOv =
            fromProduct && typeof fromProduct === 'object'
              ? optionValuesToSelectedVariations(fromProduct, variationList)
              : null;
          if (defaultOv && Object.keys(defaultOv).length > 0) {
            setSelectedVariations(defaultOv);
            defaultVariationsAppliedRef.current = true;
          }
        }
      } else {
        console.warn('[shop/product] response missing product wrapper', {
          productId,
          keys: productRes && typeof productRes === 'object' ? Object.keys(productRes) : [],
        });
        setError('Product not found');
      }

      setReviews(reviewsRes?.reviews || []);
      setAlsoBought(
        (alsoBoughtRes?.products || [])
          .map((row: Record<string, unknown>) => mapRecommendedProduct(row))
          .filter(Boolean) as RecommendedProduct[],
      );
      setSimilarProducts(
        (similarRes?.products || [])
          .map((row: Record<string, unknown>) => mapRecommendedProduct(row))
          .filter(Boolean) as RecommendedProduct[],
      );
    } catch (err: any) {
      console.error('Error loading product:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const recordProductView = async () => {
    try {
      const customerId = getResolvedCustomerId();
      if (customerId) {
        await apiClient.post(`/products/${productId}/view`, { customerId });
      }
    } catch (e) {
      // Silently fail - not critical
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================


  const matchedSku = useMemo(() => {
    if (productSkus.length === 0) return null;
    const full = resolveSkuFromSelection(productSkus, selectedVariations);
    if (full) return full;
    return resolveSkuFromSelection(productSkus, selectedVariations, { partial: true });
  }, [productSkus, selectedVariations]);

  const displayPrice = useMemo(() => {
    if (productSkus.length > 0) {
      return resolveSkuPriceForSelection(
        productSkus,
        selectedVariations,
        product?.price ?? 0,
      );
    }
    return product?.price ?? 0;
  }, [productSkus, selectedVariations, product?.price]);

  const displayOriginalPrice = useMemo(() => {
    if (matchedSku?.compare_at_price != null && matchedSku.compare_at_price > 0) {
      return matchedSku.compare_at_price;
    }
    return product?.original_price;
  }, [matchedSku, product?.original_price]);
  const displayStock = matchedSku?.stock ?? product?.stock ?? 0;
  const displayImages = useMemo(() => {
    const skuImgs = skuImages(matchedSku);
    if (skuImgs.length > 0) return skuImgs;
    return ensureImageUrls(product?.images);
  }, [matchedSku, product?.images]);

  useEffect(() => {
    if (userTouchedVariationsRef.current || defaultVariationsAppliedRef.current) return;
    if (productSkus.length === 0) return;
    const defaultSku = getDefaultProductSku(productSkus);
    if (!defaultSku?.option_values) return;
    const next = optionValuesToSelectedVariations(
      defaultSku.option_values as Record<string, unknown>,
      product?.variations,
    );
    if (Object.keys(next).length > 0) {
      setSelectedVariations(next);
      defaultVariationsAppliedRef.current = true;
    }
  }, [productSkus, product?.variations]);

  useEffect(() => {
    if (displayImages.length > 0 && selectedImage >= displayImages.length) {
      setSelectedImage(0);
    }
  }, [displayImages, selectedImage]);

  const productSnapshot = (): WarmpawzCartProductSnapshot | null => {
    if (!product) return null;
    const vendorId = product.vendor_id?.trim();
    const heroImage = displayImages[0] ?? product.images?.[0];
    return {
      id: product.id,
      name: product.name,
      price: displayPrice,
      original_price: displayOriginalPrice,
      emoji: product.emoji,
      images: heroImage ? [heroImage] : product.images,
      ...(vendorId ? { vendor_id: vendorId } : {}),
      vendor_name: product.vendor_name,
      ...(product.category_id ? { category_id: product.category_id } : {}),
      stock: displayStock,
      ...(deliveryRegions.length > 0 ? { delivery_regions: deliveryRegions } : {}),
    };
  };

  const assertCanAddToCart = (): boolean => {
    if (customerCity && !canDeliverToCustomer) {
      alert(
        deliveryBlockMessage(
          product?.name ?? 'This product',
          customerCity,
          deliveryRegions,
        ),
      );
      return false;
    }
    return true;
  };

  const cartLineId = cartLineKey(
    String(wishlistProductId || productId),
    matchedSku?.id,
  );

  useEffect(() => {
    if (!wishlistProductId || typeof window === 'undefined') return;
    const sync = () => {
      const line = readWarmpawzCartLines().find(
        (item) => String(item.product_id) === cartLineId,
      );
      setIsInCart(!!line);
      if (line) setQuantity(Math.max(1, line.quantity));
    };
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, sync);
    };
  }, [wishlistProductId, cartLineId]);

  const persistCartQuantity = (qty: number): boolean => {
    if (!product || displayStock === 0) return false;
    if (!assertCanAddToCart()) return false;
    if (productSkus.length > 0 && !matchedSku) {
      alert('Please select all product options');
      return false;
    }
    const snap = productSnapshot();
    if (!snap) return false;
    const ok = setLineQuantityInWarmpawzCartStorage({
      lineId: cartLineId,
      quantity: qty,
      product_sku_id: matchedSku?.id,
      product: snap,
      selectedVariations:
        Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined,
    });
    if (ok) setIsInCart(true);
    return ok;
  };

  const mergeLineIntoLocalCart = (): boolean => {
    if (!product || displayStock === 0) return false;
    if (!assertCanAddToCart()) return false;
    if (productSkus.length > 0 && !matchedSku) {
      alert('Please select all product options');
      return false;
    }
    const snap = productSnapshot();
    if (!snap) return false;
    const ok = mergeLineIntoWarmpawzCartStorage({
      lineId: cartLineId,
      quantity,
      product_sku_id: matchedSku?.id,
      product: snap,
      selectedVariations:
        Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined,
    });
    if (ok) setIsInCart(true);
    return ok;
  };

  const changeQuantity = (delta: number) => {
    if (!product) return;
    const next = Math.max(1, Math.min(displayStock, quantity + delta));
    setQuantity(next);
    const inCartNow = readWarmpawzCartLines().some(
      (item) => String(item.product_id) === cartLineId,
    );
    if (inCartNow) persistCartQuantity(next);
  };

  const addToCart = async () => {
    if (!product || displayStock === 0) return;

    setAddingToCart(true);
    try {
      mergeLineIntoLocalCart();
    } finally {
      setAddingToCart(false);
    }
  };

  const buyNow = () => {
    if (!mergeLineIntoLocalCart()) return;
    router.push('/cart?buynow=1');
  };

  const shareProduct = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on Warmpawz!`,
          url: window.location.href,
        });
      } catch (e) {
        // User cancelled or sharing not supported
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const markHelpful = async (reviewId: string) => {
    try {
      await apiClient.post(`/products/reviews/${reviewId}/helpful`, {});
      setReviews(reviews.map(r => 
        r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
      ));
    } catch (e) {
      console.error('Failed to mark helpful:', e);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const discount = getProductDiscountPercent(displayPrice, displayOriginalPrice);

  const finalPrice = displayPrice * quantity;

  const loadedReviewCount = reviews.length;
  const productReviewCount = product?.review_count ?? 0;
  let displayAvg = 0;
  let reviewDisplayCount = 0;
  if (loadedReviewCount > 0) {
    displayAvg =
      reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / loadedReviewCount;
    reviewDisplayCount = loadedReviewCount;
  } else if (product && productReviewCount > 0) {
    const pr = Number(product.rating);
    displayAvg = Number.isFinite(pr) && pr > 0 ? pr : 0;
    reviewDisplayCount = productReviewCount;
  }
  const showProductRatingRow = displayAvg > 0 && reviewDisplayCount > 0;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center px-6">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-sm">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-orange-300" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Shop coming soon</h2>
          <p className="text-slate-500 mb-6">We&apos;re preparing the Warmpawz marketplace for customers.</p>
          <button
            onClick={() => goBackOrHome(router)}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-500 mb-6">{error || 'This product may have been removed'}</p>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-orange-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => goBackOrHome(router)}
              className="p-2 hover:bg-slate-100 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={shareProduct}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <Share2 className="w-5 h-5 text-slate-600" />
              </button>
              <WishlistProductHeartButton
                productId={wishlistProductId}
                visualVariant="header-toolbar"
                heartClassName="w-5 h-5"
              />
              <button
                onClick={() => router.push('/shop')}
                className="relative p-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <button onClick={() => router.push('/shop')} className="hover:text-orange-600">Shop</button>
          <ChevronRight className="w-4 h-4" />
          {product.category_name && (
            <>
              <span>{product.category_name}</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
          <span className="text-slate-900 font-medium truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square bg-white rounded-2xl border border-slate-100 overflow-hidden flex items-center justify-center relative">
              <button
                type="button"
                onClick={() => goBackOrHome(router)}
                className="absolute top-3 left-3 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-900 shadow-md backdrop-blur-sm touch-manipulation active:scale-[0.98] transition-transform hover:bg-white lg:hidden"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
              </button>
              {product.images && displayImages.length > 0 ? (
                <img 
                  src={displayImages[selectedImage] ?? displayImages[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-9xl">{product.emoji || '📦'}</span>
              )}
              
              {/* Discount Badge */}
              {discount > 0 && (
                <div className="absolute top-3 left-14 z-10 px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg lg:top-4 lg:left-4">
                  {discount}% OFF
                </div>
              )}

              {/* Out of Stock Overlay */}
              {product.stock === 0 && displayStock === 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl text-lg">Out of Stock</span>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {displayImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {displayImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === index ? 'border-orange-500' : 'border-slate-200'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            {/* Vendor */}
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600">{product.vendor_name}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{product.name}</h1>

            {/* Rating */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      showProductRatingRow && star <= Math.round(displayAvg)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              {showProductRatingRow ? (
                <>
                  <span className="font-semibold text-slate-900">
                    {Number(displayAvg).toFixed(1)}
                  </span>
                  <span className="text-slate-500">
                    ({reviewDisplayCount}{' '}
                    {reviewDisplayCount === 1 ? 'review' : 'reviews'})
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-500">No customer reviews</span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-slate-900">₹{displayPrice.toLocaleString()}</span>
              {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                <>
                  <span className="text-lg text-slate-400 line-through">₹{displayOriginalPrice.toLocaleString()}</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg">
                    Save ₹{(displayOriginalPrice - displayPrice).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            <SellerProductPromotions
              vendorId={product.vendor_id}
              vendorName={product.vendor_name}
            />

            {/* Product Variations */}
            {product.variations && product.variations.length > 0 && (
              <div className="space-y-4">
                {product.variations.map((variation) => {
                  const selKey = variationSelectionKey(variation);
                  return (
                  <div key={variation.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {variation.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(variation.options || []).map((option) => {
                        const previewSelection = {
                          ...selectedVariations,
                          [selKey]: option.value,
                        };
                        const optionPrice =
                          productSkus.length > 0
                            ? resolveSkuPriceForSelection(
                                productSkus,
                                previewSelection,
                                product?.price ?? 0,
                              )
                            : option.price;
                        const basePrice =
                          productSkus.length > 0
                            ? resolveSkuPriceForSelection(
                                productSkus,
                                {},
                                product?.price ?? 0,
                              )
                            : product?.price ?? 0;
                        return (
                        <button
                          key={option.value}
                          onClick={() => {
                            userTouchedVariationsRef.current = true;
                            const next = {
                              ...selectedVariations,
                              [selKey]: option.value,
                            };
                            setSelectedVariations(next);
                            const partial = resolveSkuFromSelection(productSkus, next, {
                              partial: true,
                            });
                            const imgs = skuImages(partial);
                            if (imgs.length > 0) setSelectedImage(0);
                          }}
                          className={`px-4 py-2 rounded-xl border-2 transition-all ${
                            selectedVariations[selKey] === option.value
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          {option.value}
                          {optionPrice != null &&
                          optionPrice > 0 &&
                          optionPrice !== basePrice ? (
                            <span className="ml-1 text-xs text-slate-500">
                              ₹{optionPrice.toLocaleString()}
                            </span>
                          ) : option.price_modifier && option.price_modifier > 0 ? (
                            <span className="ml-1 text-xs text-slate-500">
                              +₹{option.price_modifier}
                            </span>
                          ) : null}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:bg-slate-100 transition-colors"
                  >
                    <Minus className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="w-14 text-center font-semibold text-slate-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="p-3 hover:bg-slate-100 transition-colors"
                    disabled={quantity >= displayStock}
                  >
                    <Plus className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                {product.stock > 0 && product.stock <= 10 && (
                  <span className="text-sm text-amber-600 font-medium">
                    Only {product.stock} left in stock!
                  </span>
                )}
              </div>
            </div>

            {(deliveryRegions.length > 0 || customerCity) && (
              <div
                className={`rounded-xl p-3 flex items-start gap-2 ${
                  customerCity && !canDeliverToCustomer
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-emerald-50 border border-emerald-200'
                }`}
              >
                <Truck
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    customerCity && !canDeliverToCustomer
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                />
                <p
                  className={`text-sm ${
                    customerCity && !canDeliverToCustomer
                      ? 'text-red-800 font-medium'
                      : 'text-emerald-800'
                  }`}
                >
                  {deliveryMessage}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={addToCart}
                disabled={
                  displayStock === 0 ||
                  addingToCart ||
                  (Boolean(customerCity) && !canDeliverToCustomer)
                }
                className={`flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  displayStock === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : isInCart
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'border-2 border-orange-500 text-orange-600 hover:bg-orange-50'
                }`}
              >
                {addingToCart ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                ) : isInCart ? (
                  <>
                    <Check className="w-5 h-5" />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>
              <button
                onClick={buyNow}
                disabled={
                  displayStock === 0 ||
                  (Boolean(customerCity) && !canDeliverToCustomer)
                }
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now • ₹{finalPrice.toLocaleString()}
              </button>
            </div>

            {/* Delivery & Trust Badges */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-slate-900">Free Delivery</p>
                  <p className="text-sm text-slate-500">On orders above ₹499</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RefreshCcw className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900">Easy Returns</p>
                  <p className="text-sm text-slate-500">7 days return policy</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium text-slate-900">100% Genuine</p>
                  <p className="text-sm text-slate-500">Authentic products only</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description & Specifications */}
        <div className="mt-12 grid lg:grid-cols-2 gap-8">
          {/* Description */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Description</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">
              {product.description || 'No description available.'}
            </p>
          </div>

          {/* Specifications */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Specifications</h2>
            <div className="space-y-3">
              {product.brand && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Brand</span>
                  <span className="font-medium text-slate-900">{product.brand}</span>
                </div>
              )}
              {product.material && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Material</span>
                  <span className="font-medium text-slate-900">{product.material}</span>
                </div>
              )}
              {product.dimensions && (
                <>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Weight</span>
                    <span className="font-medium text-slate-900">{product.dimensions.weight} kg</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Dimensions</span>
                    <span className="font-medium text-slate-900">
                      {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} cm
                    </span>
                  </div>
                </>
              )}
              {product.specifications &&
                typeof product.specifications === 'object' &&
                !Array.isArray(product.specifications) &&
                Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">{key}</span>
                  <span className="font-medium text-slate-900">{displaySpecValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12 bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Customer Reviews ({reviews.length})
            </h2>
            <button
              onClick={() => setShowReviews(!showReviews)}
              className="text-orange-600 font-medium hover:underline"
            >
              {showReviews ? 'Show Less' : 'See All'}
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(showReviews ? reviews : reviews.slice(0, 3)).map((review) => (
                <div key={review.id} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{review.customer_name}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          {review.verified_purchase && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                              Verified Purchase
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.title && (
                    <h4 className="font-semibold text-slate-900 mt-3">{review.title}</h4>
                  )}
                  <p className="text-slate-600 mt-2">{review.content}</p>
                  <button
                    onClick={() => markHelpful(review.id)}
                    className="flex items-center gap-2 mt-3 text-sm text-slate-500 hover:text-orange-600"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Helpful ({review.helpful_count})
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Also Bought Section */}
        {alsoBought.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Customers Also Bought</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {alsoBought.slice(0, 4).map((item) => (
                <RecommendedProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="mt-12 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Similar Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similarProducts.slice(0, 4).map((item) => (
                <RecommendedProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// RECOMMENDED PRODUCT CARD
// ============================================================================

function RecommendedProductCard({ product }: { product: RecommendedProduct }) {
  const router = useRouter();
  const discount = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <button
      onClick={() => router.push(`/shop/${product.id}`)}
      className="bg-white rounded-xl border border-slate-100 p-4 text-left hover:shadow-lg transition-all"
    >
      <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center text-4xl mb-3 relative">
        {product.emoji || '📦'}
        {discount > 0 && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
            {discount}%
          </div>
        )}
      </div>
      <h3 className="font-medium text-slate-900 text-sm line-clamp-2 mb-1">{product.name}</h3>
      <p className="text-xs text-orange-600 mb-2">{product.vendor_name}</p>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900">₹{product.price}</span>
        {product.original_price && product.original_price > product.price && (
          <span className="text-xs text-slate-400 line-through">₹{product.original_price}</span>
        )}
      </div>
    </button>
  );
}
