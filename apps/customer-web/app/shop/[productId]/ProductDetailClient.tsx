'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { mergeLineIntoWarmpawzCartStorage } from '@/lib/warmpawz-cart-storage';
import {
  ArrowLeft, ShoppingCart, Heart, Star, Truck, Shield, Tag,
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
}

interface ProductVariation {
  id: string;
  name: string;
  type: 'color' | 'size' | 'weight' | 'other';
  options: { value: string; price_modifier?: number; stock?: number; image?: string }[];
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductDetailClient() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
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
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const wishlistProductId = useMemo(() => {
    if (product) {
      const c = canonicalProductId(product as unknown as Record<string, unknown>);
      return (c || productId || '').trim();
    }
    return (productId || '').trim();
  }, [product, productId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (productId) {
      loadProductData();
      recordProductView();
    }
  }, [productId]);

  useEffect(() => {
    if (!wishlistProductId || typeof window === 'undefined') return;
    const wishlist = JSON.parse(localStorage.getItem('warmpawz_wishlist') || '[]');
    setIsInWishlist(
      wishlist.some((x: string) => String(x) === String(wishlistProductId))
    );
    const cart = JSON.parse(localStorage.getItem('warmpawz_cart') || '[]');
    setIsInCart(
      cart.some((item: CartItem) => String(item.product_id) === String(wishlistProductId))
    );
  }, [wishlistProductId]);

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
        apiClient.get<any>(`/ads-recommendations/products/${productId}/similar`).catch(() => ({ products: [] })),
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
        setProduct({
          ...p,
          id: resolvedId,
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
        });
      } else {
        console.warn('[shop/product] response missing product wrapper', {
          productId,
          keys: productRes && typeof productRes === 'object' ? Object.keys(productRes) : [],
        });
        setError('Product not found');
      }

      setReviews(reviewsRes?.reviews || []);
      setAlsoBought(alsoBoughtRes?.products || []);
      setSimilarProducts(similarRes?.products || []);
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

  const toggleWishlist = async () => {
    if (typeof window === 'undefined' || !wishlistProductId) return;

    const pid = wishlistProductId;
    const wishlist = JSON.parse(localStorage.getItem('warmpawz_wishlist') || '[]');
    const customerId = getResolvedCustomerId();
    const wasInList = isInWishlist;

    console.log('[wishlist] toggle start', { productId: pid, customerId, wasInList });

    if (wasInList) {
      const newWishlist = wishlist.filter((id: string) => String(id) !== String(pid));
      localStorage.setItem('warmpawz_wishlist', JSON.stringify(newWishlist));
      setIsInWishlist(false);
    } else {
      if (!wishlist.some((id: string) => String(id) === String(pid))) {
        wishlist.push(pid);
      }
      localStorage.setItem('warmpawz_wishlist', JSON.stringify(wishlist));
      setIsInWishlist(true);
    }

    if (customerId) {
      const action = wasInList ? 'remove' : 'add';
      try {
        const res = await apiClient.post<any>(`/customer/${customerId}/wishlist`, {
          productId: pid,
          action,
        });
        console.log('[wishlist] POST /customer/:customerId/wishlist response', {
          productId: pid,
          customerId,
          res,
        });
        if (action === 'add') {
          const verify = await apiClient.get<any>(`/customer/${customerId}/wishlist`);
          console.log('[wishlist] GET verify after add', {
            customerId,
            itemCount: verify?.wishlist?.items?.length ?? 0,
            items: verify?.wishlist?.items,
          });
        }
      } catch (e) {
        console.error('[wishlist] POST sync failed', { productId: pid, customerId, err: e });
      }
    } else {
      console.warn('[wishlist] no customerId resolved; saved locally only', { productId: pid });
    }
  };

  const mergeLineIntoLocalCart = (): boolean => {
    if (!product || product.stock === 0) return false;
    const lineId = wishlistProductId || productId;
    const ok = mergeLineIntoWarmpawzCartStorage({
      lineId: String(lineId),
      quantity,
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        original_price: product.original_price,
        emoji: product.emoji,
        images: product.images,
        vendor_name: product.vendor_name,
        stock: product.stock,
      },
      selectedVariations:
        Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined,
    });
    if (ok) setIsInCart(true);
    return ok;
  };

  const addToCart = async () => {
    if (!product || product.stock === 0) return;

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

  const discount = product?.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const finalPrice = product ? product.price * quantity : 0;

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
              <button
                onClick={toggleWishlist}
                className={`p-2 rounded-xl transition-colors ${
                  isInWishlist ? 'bg-red-50 text-red-500' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-current' : ''}`} />
              </button>
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
              {product.images && product.images.length > 0 ? (
                <img 
                  src={product.images[selectedImage]} 
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
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl text-lg">Out of Stock</span>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, index) => (
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
              <span className="text-3xl font-bold text-slate-900">₹{product.price.toLocaleString()}</span>
              {product.original_price && product.original_price > product.price && (
                <>
                  <span className="text-lg text-slate-400 line-through">₹{product.original_price.toLocaleString()}</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg">
                    Save ₹{(product.original_price - product.price).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {/* Product Variations */}
            {product.variations && product.variations.length > 0 && (
              <div className="space-y-4">
                {product.variations.map((variation) => (
                  <div key={variation.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {variation.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variation.options.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedVariations({
                            ...selectedVariations,
                            [variation.type]: option.value
                          })}
                          className={`px-4 py-2 rounded-xl border-2 transition-all ${
                            selectedVariations[variation.type] === option.value
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          {option.value}
                          {option.price_modifier && option.price_modifier > 0 && (
                            <span className="ml-1 text-xs text-slate-500">+₹{option.price_modifier}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
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
                    disabled={quantity >= product.stock}
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={addToCart}
                disabled={product.stock === 0 || addingToCart}
                className={`flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  product.stock === 0
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
                disabled={product.stock === 0}
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
              {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">{key}</span>
                  <span className="font-medium text-slate-900">{value}</span>
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
