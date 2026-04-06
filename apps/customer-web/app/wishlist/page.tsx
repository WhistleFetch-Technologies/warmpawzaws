'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { goBackOrHome, rememberShopBackFromCurrentUrl } from '@/lib/go-back-or-replace';
import {
  Heart,
  ShoppingCart,
  Trash2,
  ArrowLeft,
  Store,
  Star,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface WishlistItem {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    description: string;
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
  };
  added_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WishlistPage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadWishlist();
  }, []);

  async function fetchProductDetailForWishlist(id: string): Promise<any | null> {
    console.log('[wishlist] fetch product for id', { productId: id });
    try {
      return (await apiClient.get<any>(`/ecommerce/products/${id}`))?.product ?? null;
    } catch (e: any) {
      const is404 =
        e?.status === 404 ||
        e?.statusCode === 404 ||
        String(e?.message || '').includes('404');
      if (!is404) {
        console.error('[wishlist] product fetch failed', { productId: id, err: e });
        return null;
      }
      try {
        const res = await apiClient.get<any>(`/products/${id}`);
        return res?.product ?? null;
      } catch (e2) {
        console.error('[wishlist] fallback /products fetch failed', { productId: id, err: e2 });
        return null;
      }
    }
  }

  const loadWishlist = async () => {
    try {
      setLoading(true);
      setError(null);

      const customerId = getResolvedCustomerId();
      
      if (customerId) {
        // Load from API
        console.log('[wishlist] loading server wishlist', { customerId });
        const result = await apiClient.get<any>(`/customer/${customerId}/wishlist`);
        console.log('[wishlist] GET /customer/:customerId/wishlist response', {
          customerId,
          itemCount: result?.wishlist?.items?.length ?? 0,
          success: result?.success,
        });
        setWishlist(result?.wishlist?.items || []);
      } else {
        // Load from localStorage
        const localWishlist = JSON.parse(localStorage.getItem('warmpawz_wishlist') || '[]');
        console.log('[wishlist] local id list', { count: localWishlist.length, ids: localWishlist });
        if (localWishlist.length > 0) {
          const products = await Promise.all(
            localWishlist.map((pid: string) => fetchProductDetailForWishlist(pid))
          );

          setWishlist(
            products
              .filter((p: any) => p !== null)
              .map((p: any, index: number) => {
                const pid = canonicalProductId(p) || String(p?.id ?? '');
                const compareOrOriginal = p.original_price ?? p.compare_at_price;
                return {
                  id: `local-${index}`,
                  product_id: pid,
                  product: {
                    id: pid,
                    name: p.name,
                    description: p.description,
                    price: parseFloat(p.price) || 0,
                    original_price:
                      compareOrOriginal != null && String(compareOrOriginal) !== ''
                        ? parseFloat(String(compareOrOriginal))
                        : undefined,
                    images: p.images || [],
                    emoji: p.emoji || '🐾',
                    rating: p.rating || 4.5,
                    review_count: p.review_count || 0,
                    stock: p.stock_quantity || p.stock || 0,
                    vendor_id: p.vendor_id,
                    vendor_name: p.vendor_name || 'Unknown Seller',
                    is_active: p.is_active,
                  },
                  added_at: new Date().toISOString(),
                };
              })
          );
        }
      }
    } catch (err: any) {
      console.error('Error loading wishlist:', err);
      setError(err.message || 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    try {
      setProcessing(productId);
      
      const customerId = getResolvedCustomerId();
      
      if (customerId) {
        await apiClient.delete(`/customer/${customerId}/wishlist/${productId}`);
      }
      
      // Update local storage
      const localWishlist = JSON.parse(localStorage.getItem('warmpawz_wishlist') || '[]');
      localStorage.setItem(
        'warmpawz_wishlist',
        JSON.stringify(localWishlist.filter((id: string) => id !== productId))
      );
      
      // Update state
      setWishlist(wishlist.filter((item) => item.product_id !== productId));
      setSelectedItems(selectedItems.filter((id) => id !== productId));
    } catch (err) {
      console.error('Error removing from wishlist:', err);
    } finally {
      setProcessing(null);
    }
  };

  const addToCart = async (item: WishlistItem) => {
    try {
      setProcessing(item.product_id);
      
      // Add to cart in localStorage
      const cart = JSON.parse(localStorage.getItem('warmpawz_cart') || '[]');
      const existingIndex = cart.findIndex((c: any) => c.product_id === item.product_id);
      
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
      } else {
        cart.push({
          product_id: item.product_id,
          product: item.product,
          quantity: 1,
        });
      }
      
      localStorage.setItem('warmpawz_cart', JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('cart-updated'));
      
      // Remove from wishlist
      await removeFromWishlist(item.product_id);
    } catch (err) {
      console.error('Error adding to cart:', err);
    } finally {
      setProcessing(null);
    }
  };

  const addAllToCart = async () => {
    for (const item of wishlist.filter((i) => i.product.stock > 0)) {
      await addToCart(item);
    }
  };

  const toggleSelect = (productId: string) => {
    setSelectedItems((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === wishlist.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(wishlist.map((item) => item.product_id));
    }
  };

  // Calculate total savings
  const totalSavings = wishlist.reduce((sum, item) => {
    if (item.product.original_price && item.product.original_price > item.product.price) {
      return sum + (item.product.original_price - item.product.price);
    }
    return sum;
  }, 0);

  const inStockCount = wishlist.filter((i) => i.product.stock > 0).length;
  const showBottomBar = wishlist.length > 0 && !error;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-[100dvh] min-h-screen w-full max-w-customer mx-auto bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-orange-200 border-t-orange-500 mx-auto" />
          <p className="mt-4 text-slate-500 text-[15px]">Loading wishlist…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] min-h-screen w-full max-w-customer mx-auto bg-gradient-to-br from-slate-50 to-orange-50/30 flex flex-col relative">
      {/* Mobile app–style header */}
      <header className="sticky top-0 z-40 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="px-3 py-3 flex items-center gap-2 min-h-[52px]">
          <button
            type="button"
            onClick={() => goBackOrHome(router)}
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl active:bg-slate-100 text-slate-700"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
              <Heart className="w-5 h-5 text-red-500 fill-red-500 shrink-0" />
              <span className="truncate">My Wishlist</span>
            </h1>
            <p className="text-[13px] text-slate-500">
              {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 px-3 pt-3 ${showBottomBar ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'}`}
      >
        {error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 px-4">
            <AlertCircle className="w-14 h-14 mx-auto mb-4 text-red-300" />
            <p className="text-slate-600 font-medium">Unable to load wishlist</p>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <button
              type="button"
              onClick={loadWishlist}
              className="mt-5 min-h-11 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium active:bg-orange-600"
            >
              Try Again
            </button>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 px-4">
            <Heart className="w-16 h-16 mx-auto mb-5 text-slate-200" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Your wishlist is empty</h2>
            <p className="text-slate-500 mb-6 text-[15px]">Save items you love to your wishlist</p>
            <button
              type="button"
              onClick={() => {
                rememberShopBackFromCurrentUrl();
                router.push('/shop');
              }}
              className="min-h-11 w-full max-w-xs mx-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-md active:opacity-95"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            {totalSavings > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 mb-3 text-white flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[15px]">Total potential savings</p>
                  <p className="text-xs text-emerald-100 mt-0.5">If you buy all discounted items</p>
                </div>
                <p className="text-xl font-bold shrink-0">₹{totalSavings.toLocaleString()}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {wishlist.map((item) => {
                const discount =
                  item.product.original_price && item.product.original_price > item.product.price
                    ? Math.round(
                        ((item.product.original_price - item.product.price) /
                          item.product.original_price) *
                          100
                      )
                    : 0;

                const imageUrl =
                  Array.isArray(item.product.images) && item.product.images.length > 0
                    ? String(item.product.images[0])
                    : null;
                const showImage = Boolean(imageUrl && !brokenImages[item.id]);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm active:shadow-md transition-shadow"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/shop/${item.product_id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/shop/${item.product_id}`);
                        }
                      }}
                      className="aspect-[4/3] sm:aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-5xl cursor-pointer relative overflow-hidden"
                    >
                      {showImage ? (
                        <img
                          src={imageUrl!}
                          alt=""
                          className="absolute inset-0 z-0 w-full h-full object-cover"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                          }
                        />
                      ) : (
                        <span className="relative z-0">{item.product.emoji || '📦'}</span>
                      )}

                      {discount > 0 && item.product.stock > 0 && (
                        <div className="absolute top-2.5 left-2.5 z-10 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                          {discount}% OFF
                        </div>
                      )}

                      {item.product.stock === 0 && (
                        <div className="absolute inset-0 z-10 bg-black/45 flex items-center justify-center p-4">
                          <span className="px-4 py-2.5 bg-white text-slate-900 text-sm font-bold rounded-xl tracking-wide uppercase shadow-lg">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5">
                      <p className="text-xs text-orange-600 font-semibold mb-1 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.product.vendor_name}</span>
                      </p>

                      <h3
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/shop/${item.product_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/shop/${item.product_id}`);
                          }
                        }}
                        className="font-semibold text-slate-900 text-[15px] leading-snug line-clamp-2 mb-2 cursor-pointer active:text-orange-600"
                      >
                        {item.product.name}
                      </h3>

                      <div className="flex items-center gap-1 mb-2.5">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-900">{item.product.rating}</span>
                        <span className="text-sm text-slate-400">({item.product.review_count})</span>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-bold text-slate-900">
                          ₹{item.product.price.toLocaleString()}
                        </span>
                        {item.product.original_price &&
                          item.product.original_price > item.product.price && (
                            <span className="text-sm text-slate-400 line-through">
                              ₹{item.product.original_price.toLocaleString()}
                            </span>
                          )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          disabled={item.product.stock === 0 || processing === item.product_id}
                          className={`flex-1 min-h-11 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                            item.product.stock === 0
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                          }`}
                        >
                          {processing === item.product_id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <ShoppingCart className="w-5 h-5 shrink-0" />
                              Add to Cart
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromWishlist(item.product_id)}
                          disabled={processing === item.product_id}
                          aria-label="Remove from wishlist"
                          className="min-h-11 min-w-11 shrink-0 flex items-center justify-center border border-slate-200 text-slate-500 rounded-xl active:bg-red-50 active:border-red-200 active:text-red-500"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Fixed bottom bar — native-style primary action */}
      {showBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center">
          <div className="w-full max-w-customer pointer-events-auto bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={addAllToCart}
              disabled={inStockCount === 0}
              className={`w-full min-h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                inStockCount === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
              }`}
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              Add All to Cart
              {inStockCount > 0 && inStockCount < wishlist.length && (
                <span className="text-sm font-medium opacity-90">({inStockCount} in stock)</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
