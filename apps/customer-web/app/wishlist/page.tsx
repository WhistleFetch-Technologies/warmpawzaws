'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { canonicalProductId } from '@/lib/product-id';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  Heart, ShoppingCart, Trash2, ArrowLeft, Package,
  Store, Star, Check, AlertCircle, ShoppingBag
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

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                My Wishlist
              </h1>
              <p className="text-sm text-slate-500">{wishlist.length} items saved</p>
            </div>
          </div>
          {wishlist.length > 0 && (
            <button
              onClick={addAllToCart}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Add All to Cart
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
            <p className="text-slate-600 font-medium">Unable to load wishlist</p>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <button
              onClick={loadWishlist}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Try Again
            </button>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Heart className="w-20 h-20 mx-auto mb-6 text-slate-200" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Your wishlist is empty</h2>
            <p className="text-slate-500 mb-6">Save items you love to your wishlist</p>
            <button
              onClick={() => router.push('/shop')}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Savings Banner */}
            {totalSavings > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 mb-6 text-white flex items-center justify-between">
                <div>
                  <p className="font-semibold">Total Potential Savings</p>
                  <p className="text-sm text-emerald-100">If you buy all discounted items</p>
                </div>
                <p className="text-2xl font-bold">₹{totalSavings.toLocaleString()}</p>
              </div>
            )}

            {/* Wishlist Items */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((item) => {
                const discount =
                  item.product.original_price && item.product.original_price > item.product.price
                    ? Math.round(
                        ((item.product.original_price - item.product.price) /
                          item.product.original_price) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all"
                  >
                    {/* Product Image */}
                    <div
                      onClick={() => router.push(`/shop/${item.product_id}`)}
                      className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-6xl cursor-pointer relative"
                    >
                      {item.product.emoji || '📦'}
                      
                      {/* Discount Badge */}
                      {discount > 0 && (
                        <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                          {discount}% OFF
                        </div>
                      )}
                      
                      {/* Out of Stock */}
                      {item.product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="px-4 py-2 bg-white text-slate-900 font-bold rounded-lg">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="p-4">
                      {/* Vendor */}
                      <p className="text-xs text-orange-600 font-medium mb-1 flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {item.product.vendor_name}
                      </p>

                      {/* Name */}
                      <h3
                        onClick={() => router.push(`/shop/${item.product_id}`)}
                        className="font-semibold text-slate-900 line-clamp-2 h-12 mb-2 cursor-pointer hover:text-orange-600"
                      >
                        {item.product.name}
                      </h3>

                      {/* Rating */}
                      <div className="flex items-center gap-1 mb-3">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {item.product.rating}
                        </span>
                        <span className="text-sm text-slate-400">
                          ({item.product.review_count})
                        </span>
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl font-bold text-slate-900">
                          ₹{item.product.price.toLocaleString()}
                        </span>
                        {item.product.original_price &&
                          item.product.original_price > item.product.price && (
                            <span className="text-sm text-slate-400 line-through">
                              ₹{item.product.original_price.toLocaleString()}
                            </span>
                          )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => addToCart(item)}
                          disabled={item.product.stock === 0 || processing === item.product_id}
                          className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                            item.product.stock === 0
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg'
                          }`}
                        >
                          {processing === item.product_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4" />
                              Add to Cart
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => removeFromWishlist(item.product_id)}
                          disabled={processing === item.product_id}
                          className="p-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
