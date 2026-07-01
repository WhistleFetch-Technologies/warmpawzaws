'use client';

import type { ShopProduct } from '@/components/shop/shop-types';
import { RecommendationProductTile } from './RecommendationProductTile';

type RecommendationProductScrollerProps = {
  products: ShopProduct[];
  title?: string;
  loading?: boolean;
  onAdd?: (product: ShopProduct) => void;
  onProductClick?: (product: ShopProduct) => void;
  showAddButton?: boolean;
  className?: string;
};

export function RecommendationProductScroller({
  products,
  title = 'You may also like',
  loading = false,
  onAdd,
  onProductClick,
  showAddButton = true,
  className = '',
}: RecommendationProductScrollerProps) {
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${className}`.trim()}
    >
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Loading suggestions…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
          {products.map((product) => (
            <RecommendationProductTile
              key={product.id}
              product={product}
              showAddButton={showAddButton}
              onAdd={onAdd ? () => onAdd(product) : undefined}
              onClick={onProductClick ? () => onProductClick(product) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
