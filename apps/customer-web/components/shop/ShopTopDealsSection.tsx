'use client';

import type { ShopProduct } from './shop-types';
import { ShopProductCard } from './ShopProductCard';

interface ShopTopDealsSectionProps {
  products: ShopProduct[];
  loading: boolean;
  cartProductIds: Set<string>;
  onAddToCart: (product: ShopProduct) => void;
  onViewAll: () => void;
}

export function ShopTopDealsSection({
  products,
  loading,
  cartProductIds,
  onAddToCart,
  onViewAll,
}: ShopTopDealsSectionProps) {
  if (!loading && products.length === 0) return null;

  return (
    <div id="shop-top-deals" className="mt-5">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-sm font-bold text-slate-900">Top Deals for Your Pets</h2>
        <button type="button" onClick={onViewAll} className="text-xs font-semibold text-[#FF8C42]">
          View all
        </button>
      </div>

      {loading ? (
        <div className="flex gap-3 px-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-[9.5rem] h-44 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product) => (
            <ShopProductCard
              key={product.id}
              product={product}
              variant="deal"
              onAddToCart={() => onAddToCart(product)}
              inCart={cartProductIds.has(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
