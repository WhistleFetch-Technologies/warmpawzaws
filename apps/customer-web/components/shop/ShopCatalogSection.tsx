'use client';

import { useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import type { ShopProduct } from './shop-types';
import { ShopProductCard } from './ShopProductCard';

interface ShopCatalogSectionProps {
  loading: boolean;
  error: string | null;
  products: ShopProduct[];
  getCartQuantity: (productId: string) => number;
  /** Whether more products are available from the server. */
  hasMore: boolean;
  /** True while the next page is being fetched (appending). */
  loadingMore: boolean;
  onRetry: () => void;
  onAddToCart: (product: ShopProduct) => void;
  onQuantityChange: (product: ShopProduct, quantity: number) => void;
  /** Called by IntersectionObserver when the bottom sentinel is visible. */
  onLoadMore: () => void;
}

export function ShopCatalogSection({
  loading,
  error,
  products,
  getCartQuantity,
  hasMore,
  loadingMore,
  onRetry,
  onAddToCart,
  onQuantityChange,
  onLoadMore,
}: ShopCatalogSectionProps) {
  /** Sentinel element watched by IntersectionObserver to trigger the next page load. */
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, onLoadMore]);

  return (
    <div id="shop-all-products" className="mt-5 px-4 scroll-mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">All Products</h2>
          {!loading && !error && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{products.length}</span> products loaded
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-orange-200 border-t-[#FF8C42]" />
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
            onClick={onRetry}
            className="mt-4 px-5 py-2.5 text-sm font-bold bg-[#FF8C42] text-white rounded-xl shadow-md"
          >
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 px-3 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-100">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-700 font-semibold text-sm">No products match</p>
          <p className="text-xs text-slate-400 mt-1">Try another category or search</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 min-w-0 w-full items-stretch [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
            {products.map((product) => (
              <div key={product.id} className="min-w-0 max-w-full flex min-h-0">
                <ShopProductCard
                  product={product}
                  variant="grid"
                  cartQuantity={getCartQuantity(product.id)}
                  onAddToCart={() => onAddToCart(product)}
                  onQuantityChange={(quantity) => onQuantityChange(product, quantity)}
                />
              </div>
            ))}
          </div>

          {/* Sentinel watched by IntersectionObserver — triggers next page load */}
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-200 border-t-[#FF8C42]" />
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <p className="text-center text-slate-400 text-xs py-6">
              All {products.length} products loaded
            </p>
          )}
        </>
      )}
    </div>
  );
}
