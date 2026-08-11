'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { useShopProductId } from '@/lib/use-shop-product-id';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { useDeepLinkBackStack } from '@/lib/navigation/use-deep-link-back-stack';
import { CUSTOMER_ROUTES } from '@/lib/navigation/route-registry';
import {
  mergeLineIntoWarmpawzCartStorage,
  setLineQuantityInWarmpawzCartStorage,
  readWarmpawzCartLines,
  CART_UPDATED_EVENT,
} from '@/lib/warmpawz-cart-storage';
import type { WarmpawzCartProductSnapshot } from '@/lib/warmpawz-cart-storage';
import { WishlistProductHeartButton } from '@/components/customer/WishlistProductHeartButton';
import { WishlistCountBadge } from '@/components/customer/WishlistCountBadge';
import { useWishlistCount } from '@/lib/use-wishlist-count';
import { SellerProductPromotions } from '@/components/customer/ecommerce/SellerProductPromotions';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { isShopUiVisibleForAccount, readStoredCustomerPhone } from '@/lib/app-review-demo-account';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import {
  getProductDiscountPercent,
  listPriceForDiscountDisplay,
  resolveProductCompareAtPrice,
  resolveProductSellingPrice,
} from '@/lib/shop-product-pricing';
import { PriceDisplay } from '@/components/customer/pricing/PriceDisplay';
import {
  type ClientProductSku,
  resolveSkuFromSelection,
  resolveSkuPriceForSelection,
  skuImages,
  cartLineKey,
  getInitialProductSku,
  hasIncompleteVariantSelection,
  hasInvalidVariantSelection,
  isOptionValueAvailable,
  optionValuesToSelectedVariations,
  parseClientSkuPrice,
  variationSelectionKey,
  resolveDisplaySku,
  sanitizeVariantSelection,
} from '@/lib/product-sku-client';
import {
  readCheckoutAddressId,
} from '@/lib/ecommerce/checkout-address-storage';
import { ECOMMERCE_DEFAULT_DELIVERY_FEE } from '@/lib/ecommerce/cart-pricing';
import {
  displayProductSpecValue,
  isMeaningfulProductSpecValue,
  meaningfulSpecEntries,
} from '@/lib/ecommerce/product-spec-display';
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
import { computeDeliverySlaEstimate } from '@warmpawz/shared-types';
import {
  ECOMMERCE_RECOMMENDATIONS_LIMIT,
  loadProductRecommendations,
} from '@/lib/ecommerce/load-ecommerce-recommendations';
import { RecommendationProductScroller } from '@/components/ecommerce/shared/RecommendationProductScroller';
import { ProductImageGallery } from '@/components/ecommerce/ProductImageGallery';
import type { ShopProduct } from '@/components/shop/shop-types';
import { shopProductToCartItem } from '@/lib/ecommerce/cart-product-helpers';
import { useCart } from '@/context/CartContext';
import {
  ArrowLeft, ShoppingCart, Star, Truck, Shield, Tag,
  Package, Check, Plus, Minus, Share2, ChevronRight,
  Clock, ThumbsUp, User, AlertCircle
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
  vendor_state?: string;
  vendor_pincode?: string;
  vendor_shipping_origin_pincode?: string;
  brand?: string;
  material?: string;
  dimensions?: { length: number; width: number; height: number; weight: number };
  variations?: ProductVariation[];
  specifications?: Record<string, string>;
  is_active: boolean;
  delivery_regions?: string[];
  key_features?: string;
  pet_type?: string;
  pet_type_display?: string;
  manufacturing_details?: string;
  has_variants?: boolean;
  price_from?: boolean;
  min_price?: number;
  default_option_values?: Record<string, string>;
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

const DESCRIPTION_TOGGLE_MIN_LEN = 120;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductDetailClient() {
  const nav = useCustomerNavigation();
  useDeepLinkBackStack();
  const { cart, addToCart: addRecommendationToCart, updateQuantity } = useCart();
  const productId = useShopProductId();

  const [product, setProduct] = useState<Product | null>(null);
  const [productSkus, setProductSkus] = useState<ClientProductSku[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [recommendations, setRecommendations] = useState<ShopProduct[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [showReviews, setShowReviews] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [customerCity, setCustomerCity] = useState<string | null>(null);
  const [customerPincode, setCustomerPincode] = useState<string | null>(null);
  const [customerState, setCustomerState] = useState<string | null>(null);
  const [guestPincode, setGuestPincode] = useState('');
  const [guestPincodeApplied, setGuestPincodeApplied] = useState('');
  const userTouchedVariationsRef = useRef(false);
  const defaultVariationsAppliedRef = useRef(false);

  const wishlistProductId = useMemo(() => {
    if (product) {
      const c = canonicalProductId(product as unknown as Record<string, unknown>);
      return (c || productId || '').trim();
    }
    return (productId || '').trim();
  }, [product, productId]);

  const wishlistCount = useWishlistCount();

  const handleBack = () => {
    nav.backOr(CUSTOMER_ROUTES.shop.path);
  };

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
        if (!cancelled) {
          if (picked?.city) {
            setCustomerCity(String(picked.city).trim());
          }
          if (picked?.pincode) {
            setCustomerPincode(String(picked.pincode).trim());
          }
          if (picked?.state) {
            setCustomerState(String(picked.state).trim());
          }
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

  const activeCustomerPincode = customerPincode || guestPincodeApplied || null;

  const deliveryEstimate = useMemo(() => {
    if (!product || !activeCustomerPincode) return null;
    return computeDeliverySlaEstimate(
      {
        state: product.vendor_state,
        city: undefined,
        pincode: product.vendor_pincode,
        shippingOriginPincode: product.vendor_shipping_origin_pincode,
      },
      {
        pincode: activeCustomerPincode,
        state: customerState,
        city: customerCity,
      },
    );
  }, [product, activeCustomerPincode, customerState, customerCity]);

  const handleApplyGuestPincode = () => {
    const trimmed = guestPincode.replace(/\D/g, '').slice(0, 6);
    if (trimmed.length === 6) {
      setGuestPincodeApplied(trimmed);
    }
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    setSelectedImage(0);
    setQuantity(1);
    setShowReviews(false);
    setSelectedVariations({});
    setDescriptionExpanded(false);
    userTouchedVariationsRef.current = false;
    defaultVariationsAppliedRef.current = false;
    setGuestPincode('');
    setGuestPincodeApplied('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setError('Product not found');
      return;
    }
    loadProductData();
    recordProductView();
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    async function loadRecs() {
      setRecsLoading(true);
      try {
        const products = await loadProductRecommendations(
          productId,
          ECOMMERCE_RECOMMENDATIONS_LIMIT,
        );
        if (!cancelled) {
          setRecommendations(products.filter((p) => p.id !== productId));
        }
      } catch {
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }
    void loadRecs();
    return () => {
      cancelled = true;
    };
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
      const customerId = getResolvedCustomerId();
      const customerQuery = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
      try {
        productRes = await apiClient.get<any>(`/ecommerce/products/${productId}${customerQuery}`);
      } catch (firstErr: any) {
        const is404 =
          firstErr?.status === 404 ||
          firstErr?.statusCode === 404 ||
          String(firstErr?.message || '').includes('404');
        if (is404) {
          console.warn('[shop/product] ecommerce detail 404, retrying /products/:id', {
            productId,
          });
          productRes = await apiClient.get<any>(`/products/${productId}${customerQuery}`);
        } else {
          throw firstErr;
        }
      }

      const reviewsRes = await apiClient
        .get<any>(`/products/${productId}/reviews`)
        .catch(() => ({ reviews: [] }));

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
                ? displayProductSpecValue(p.description)
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
          listing_option_values: p.listing_option_values,
          default_option_values: p.default_option_values ?? p.listing_option_values,
          has_variants: Boolean(p.has_variants ?? p.has_variations),
          price_from: Boolean(p.price_from),
          min_price:
            p.min_price != null && Number.isFinite(Number(p.min_price))
              ? Number(p.min_price)
              : undefined,
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
          const fromProduct =
            (p.listing_option_values ?? p.default_option_values) as Record<string, unknown> | undefined;
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
    return resolveDisplaySku(productSkus, selectedVariations, product?.variations);
  }, [productSkus, selectedVariations, product?.variations]);

  const exactMatchedSku = useMemo(() => {
    if (productSkus.length === 0) return null;
    return resolveSkuFromSelection(productSkus, selectedVariations);
  }, [productSkus, selectedVariations]);

  const invalidVariantSelection = useMemo(
    () =>
      hasInvalidVariantSelection(
        productSkus,
        selectedVariations,
        product?.variations,
      ),
    [productSkus, selectedVariations, product?.variations],
  );

  const productPromoRatio = useMemo(() => {
    const compareAt = product?.original_price;
    const selling = product?.price;
    if (compareAt != null && selling != null && compareAt > selling && selling > 0) {
      return selling / compareAt;
    }
    return null;
  }, [product?.original_price, product?.price]);

  const catalogUnitPrice = useMemo(() => {
    // Storefront enrichment sets price=selling and original_price=MRP. Non-SKU
    // catalog base must be MRP so productPromoRatio is applied only once (PLP Option A).
    const catalogFallback = product?.original_price ?? product?.price ?? 0;
    if (productSkus.length > 0) {
      return resolveSkuPriceForSelection(
        productSkus,
        selectedVariations,
        catalogFallback,
        product?.variations,
      );
    }
    return catalogFallback;
  }, [productSkus, selectedVariations, product?.original_price, product?.price, product?.variations]);

  const displayPrice = useMemo(() => {
    if (productPromoRatio != null && catalogUnitPrice > 0) {
      return Math.round(catalogUnitPrice * productPromoRatio * 100) / 100;
    }
    return catalogUnitPrice;
  }, [catalogUnitPrice, productPromoRatio]);

  const displayOriginalPrice = useMemo(() => {
    if (productPromoRatio != null && catalogUnitPrice > 0) {
      return catalogUnitPrice;
    }
    if (matchedSku?.compare_at_price != null && matchedSku.compare_at_price > 0) {
      return matchedSku.compare_at_price;
    }
    return product?.original_price;
  }, [productPromoRatio, catalogUnitPrice, matchedSku, product?.original_price]);
  const showFromPrice = useMemo(() => {
    if (!product?.price_from || productSkus.length === 0) return false;
    return hasIncompleteVariantSelection(productSkus, selectedVariations);
  }, [product?.price_from, productSkus, selectedVariations]);

  const headerPrice = showFromPrice && product?.min_price != null ? product.min_price : displayPrice;

  const displayStock = exactMatchedSku?.stock ?? matchedSku?.stock ?? product?.stock ?? 0;

  const displayImages = useMemo(() => {
    const skuImgs = skuImages(matchedSku);
    if (skuImgs.length > 0) return skuImgs;
    return ensureImageUrls(product?.images);
  }, [matchedSku, product?.images]);

  const templateSpecEntries = useMemo(
    () => meaningfulSpecEntries(product?.specifications),
    [product?.specifications],
  );

  const showSpecificationsSection = useMemo(() => {
    if (!product) return false;
    if (isMeaningfulProductSpecValue(product.brand)) return true;
    if (isMeaningfulProductSpecValue(product.pet_type_display ?? product.pet_type)) return true;
    if (isMeaningfulProductSpecValue(product.manufacturing_details)) return true;
    if (isMeaningfulProductSpecValue(product.material)) return true;
    if (product.dimensions && product.dimensions.weight > 0) return true;
    if (
      product.dimensions &&
      (product.dimensions.length > 0 ||
        product.dimensions.width > 0 ||
        product.dimensions.height > 0)
    ) {
      return true;
    }
    return templateSpecEntries.length > 0;
  }, [product, templateSpecEntries]);

  useEffect(() => {
    if (userTouchedVariationsRef.current || defaultVariationsAppliedRef.current) return;
    if (productSkus.length === 0) return;
    const initialSku = getInitialProductSku(productSkus);
    if (!initialSku?.option_values) return;
    const next = optionValuesToSelectedVariations(
      initialSku.option_values as Record<string, unknown>,
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

  useEffect(() => {
    setSelectedImage(0);
  }, [matchedSku?.id, displayImages[0]]);

  const productSnapshot = (): WarmpawzCartProductSnapshot | null => {
    if (!product) return null;
    const vendorId = product.vendor_id?.trim();
    const heroImage = displayImages[0] ?? product.images?.[0];
    return {
      id: product.id,
      name: product.name,
      price: catalogUnitPrice,
      original_price: displayOriginalPrice ?? catalogUnitPrice,
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
    exactMatchedSku?.id,
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
    if (productSkus.length > 0 && !exactMatchedSku) {
      alert(invalidVariantSelection
        ? 'This combination is not available'
        : 'Please select all product options');
      return false;
    }
    const snap = productSnapshot();
    if (!snap) return false;
    const ok = setLineQuantityInWarmpawzCartStorage({
      lineId: cartLineId,
      quantity: qty,
      product_sku_id: exactMatchedSku?.id,
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
    if (productSkus.length > 0 && !exactMatchedSku) {
      alert(invalidVariantSelection
        ? 'This combination is not available'
        : 'Please select all product options');
      return false;
    }
    const snap = productSnapshot();
    if (!snap) return false;
    const ok = mergeLineIntoWarmpawzCartStorage({
      lineId: cartLineId,
      quantity,
      product_sku_id: exactMatchedSku?.id,
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
    nav.goToCart({ buynow: true });
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

  const discount = getProductDiscountPercent(headerPrice, displayOriginalPrice);

  const finalPrice = displayPrice * quantity;

  const descriptionText = product?.description?.trim() ?? '';

  // ============================================================================
  // RENDER
  // ============================================================================

  if (typeof window !== 'undefined' && !isShopUiVisibleForAccount(readStoredCustomerPhone())) {
    return <AppReviewDemoRouteGuard>{null}</AppReviewDemoRouteGuard>;
  }

  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center px-6">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-sm">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-orange-300" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Shop coming soon</h2>
          <p className="text-slate-500 mb-6">We&apos;re preparing the Warmpawz marketplace for customers.</p>
          <button
            onClick={handleBack}
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
            onClick={() => nav.goToShop()}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-orange-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))] pb-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 hover:bg-slate-100 rounded-xl"
              aria-label="Go back"
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
              <div className="relative">
                <WishlistProductHeartButton
                  productId={wishlistProductId}
                  visualVariant="header-toolbar"
                  heartClassName="w-5 h-5"
                />
                <WishlistCountBadge count={wishlistCount} size="md" className="-top-1 -right-1" />
              </div>
              <button
                onClick={() => nav.goToShop()}
                className="relative p-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 min-w-0">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <button onClick={() => nav.goToShop()} className="hover:text-orange-600">Shop</button>
          <ChevronRight className="w-4 h-4" />
          {product.category_name && (
            <>
              <span>{product.category_name}</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
          <span className="text-slate-900 font-medium truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 min-w-0">
          {/* Product Images */}
          <div className="min-w-0">
            <ProductImageGallery
              images={displayImages}
              alt={product.name}
              selectedIndex={selectedImage}
              onSelectedIndexChange={setSelectedImage}
              fallbackEmoji={product.emoji || '📦'}
              overlayTopLeft={
                discount > 0 ? (
                  <div className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg">
                    {discount}% OFF
                  </div>
                ) : undefined
              }
              overlayCenter={
                displayStock === 0 ? (
                  <div className="flex h-full w-full items-center justify-center bg-black/50">
                    <span className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl text-lg">
                      Out of Stock
                    </span>
                  </div>
                ) : undefined
              }
            />
          </div>

          {/* Product Details */}
          <div className="space-y-6 min-w-0">
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{product.name}</h1>

            {/* Price */}
            <div className="flex flex-row items-baseline justify-between gap-3">
              <div className="flex items-center gap-4 flex-wrap min-w-0">
                <PriceDisplay
                  originalPrice={
                    displayOriginalPrice && displayOriginalPrice > displayPrice
                      ? displayOriginalPrice
                      : displayPrice
                  }
                  currentPrice={headerPrice}
                  size="lg"
                  prefix={showFromPrice ? 'From ' : undefined}
                  showSavings={Boolean(
                    displayOriginalPrice && displayOriginalPrice > displayPrice && !showFromPrice
                  )}
                />
              </div>
              {isMeaningfulProductSpecValue(product.key_features) && (
                <div className="flex flex-col gap-0.5 items-end text-right shrink-0 max-w-[48%]">
                  <span className="text-xs text-slate-500">Key Features</span>
                  <span className="text-sm font-medium text-slate-900 whitespace-pre-line">
                    {displayProductSpecValue(product.key_features)}
                  </span>
                </div>
              )}
            </div>

            {descriptionText && (
              <div>
                <p
                  className={`text-sm text-slate-600 leading-relaxed whitespace-pre-line ${
                    descriptionExpanded ? '' : 'line-clamp-3'
                  }`}
                >
                  {descriptionText}
                </p>
                {descriptionText.length > DESCRIPTION_TOGGLE_MIN_LEN && (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((v) => !v)}
                    className="mt-1 text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    {descriptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            <SellerProductPromotions vendorId={product.vendor_id} />

            {/* Product Variations */}
            {product.variations && product.variations.length > 0 && (
              <div className="space-y-4">
                {invalidVariantSelection && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    This combination is not available
                  </div>
                )}
                {product.variations.map((variation) => {
                  const selKey = variationSelectionKey(variation);
                  return (
                  <div key={variation.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {variation.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(variation.options || []).map((option) => {
                        const available =
                          productSkus.length === 0 ||
                          isOptionValueAvailable(
                            productSkus,
                            selectedVariations,
                            selKey,
                            option.value,
                            product.variations,
                          );
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
                                product?.variations,
                              )
                            : option.price;
                        const basePrice =
                          productSkus.length > 0
                            ? resolveSkuPriceForSelection(
                                productSkus,
                                {},
                                product?.price ?? 0,
                                product?.variations,
                              )
                            : product?.price ?? 0;
                        return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            if (!available) return;
                            userTouchedVariationsRef.current = true;
                            const next = sanitizeVariantSelection(
                              productSkus,
                              selectedVariations,
                              selKey,
                              option.value,
                              product.variations ?? [],
                            );
                            setSelectedVariations(next);
                            const partial = resolveSkuFromSelection(productSkus, next, {
                              partial: true,
                            });
                            const imgs = skuImages(partial);
                            if (imgs.length > 0) setSelectedImage(0);
                          }}
                          className={`px-4 py-2 rounded-xl border-2 transition-all ${
                            !available
                              ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed line-through'
                              : selectedVariations[selKey] === option.value
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
                    onClick={() => setQuantity(Math.min(displayStock, quantity + 1))}
                    className="p-3 hover:bg-slate-100 transition-colors"
                    disabled={quantity >= displayStock || displayStock === 0}
                  >
                    <Plus className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                {displayStock > 0 && displayStock <= 10 && (
                  <span className="text-sm text-amber-600 font-medium">
                    Only {displayStock} left in stock!
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
                  invalidVariantSelection ||
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
                  invalidVariantSelection ||
                  (Boolean(customerCity) && !canDeliverToCustomer)
                }
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now • ₹{finalPrice.toLocaleString()}
              </button>
            </div>

            {/* Delivery & Trust Badges */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">Standard Delivery</p>
                  {deliveryEstimate ? (
                    <>
                      <p className="text-sm font-medium text-emerald-700 mt-0.5">
                        {deliveryEstimate.deliverByLabel}
                      </p>
                      <p className="text-sm text-slate-500">{deliveryEstimate.label}</p>
                    </>
                  ) : activeCustomerPincode ? null : (
                    <p className="text-sm text-slate-500 mt-0.5">
                      Enter pincode to see delivery date
                    </p>
                  )}
                  {!activeCustomerPincode && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit pincode"
                        value={guestPincode}
                        onChange={(e) =>
                          setGuestPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleApplyGuestPincode();
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleApplyGuestPincode}
                        disabled={guestPincode.replace(/\D/g, '').length !== 6}
                        className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Check
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-1">
                    ₹{ECOMMERCE_DEFAULT_DELIVERY_FEE.toLocaleString('en-IN')} on all orders
                  </p>
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

        {/* Specifications */}
        {showSpecificationsSection && (
          <div className="mt-12">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Specifications</h2>
              <div className="space-y-3">
                {isMeaningfulProductSpecValue(product.brand) && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Brand</span>
                    <span className="font-medium text-slate-900">{product.brand}</span>
                  </div>
                )}
                {isMeaningfulProductSpecValue(product.pet_type_display ?? product.pet_type) && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Pet Type</span>
                    <span className="font-medium text-slate-900">
                      {product.pet_type_display ?? product.pet_type}
                    </span>
                  </div>
                )}
                {isMeaningfulProductSpecValue(product.manufacturing_details) && (
                  <div className="py-2 border-b border-slate-100">
                    <span className="text-slate-600 block mb-1">Manufacturing Details</span>
                    <span className="font-medium text-slate-900 whitespace-pre-line">
                      {displayProductSpecValue(product.manufacturing_details)}
                    </span>
                  </div>
                )}
                {isMeaningfulProductSpecValue(product.material) && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Material</span>
                    <span className="font-medium text-slate-900">{product.material}</span>
                  </div>
                )}
                {product.dimensions && product.dimensions.weight > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Weight</span>
                    <span className="font-medium text-slate-900">{product.dimensions.weight} kg</span>
                  </div>
                )}
                {product.dimensions &&
                  (product.dimensions.length > 0 ||
                    product.dimensions.width > 0 ||
                    product.dimensions.height > 0) && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Dimensions</span>
                    <span className="font-medium text-slate-900">
                      {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} cm
                    </span>
                  </div>
                )}
                {templateSpecEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">{key}</span>
                    <span className="font-medium text-slate-900">{displayProductSpecValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

        {/* You may also like */}
        <RecommendationProductScroller
          products={recommendations}
          loading={recsLoading}
          className="mt-12 mb-8"
          getCartQuantity={(id) => cart.find((i) => i.id === id)?.quantity ?? 0}
          onAdd={(p) => addRecommendationToCart(shopProductToCartItem(p))}
          onQuantityChange={(p, quantity) => updateQuantity(p.id, quantity)}
          onProductClick={(p) => {
            if (p.id === productId) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
            nav.goToProduct(p.id);
          }}
        />
      </main>
    </div>
  );
}
