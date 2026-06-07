'use client';

import { ChevronDown } from 'lucide-react';
import { Package, Truck } from 'lucide-react';
import type { ShopProduct } from './shop-types';
import { SHOP_SORT_LABELS } from './shop-types';
import { ShopProductCard } from './ShopProductCard';

interface ShopCatalogSectionProps {
  loading: boolean;
  error: string | null;
  products: ShopProduct[];
  getCartQuantity: (productId: string) => number;
  sortBy: string;
  cartSubtotal: number;
  onRetry: () => void;
  onAddToCart: (product: ShopProduct) => void;
  onQuantityChange: (product: ShopProduct, quantity: number) => void;
  onOpenSort: () => void;
}

export function ShopCatalogSection({
  loading,
  error,
  products,
  getCartQuantity,
  sortBy,
  cartSubtotal,
  onRetry,
  onAddToCart,
  onQuantityChange,
  onOpenSort,
}: ShopCatalogSectionProps) {
  return (
    <div id="shop-all-products" className="mt-5 px-4 scroll-mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">All Products</h2>
          {!loading && !error && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{products.length}</span> products
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSort}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200/90"
        >
          <span className="truncate max-w-[7rem]">{SHOP_SORT_LABELS[sortBy] || 'Sort'}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
        </button>
      </div>

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
      )}
    </div>
  );
}
