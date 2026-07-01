'use client';

import { useEffect, useState } from 'react';
import type { ShopProduct } from '@/components/shop/shop-types';

type RecommendationProductTileProps = {
  product: ShopProduct;
  onAdd?: () => void;
  onClick?: () => void;
  showAddButton?: boolean;
};

export function RecommendationProductTile({
  product,
  onAdd,
  onClick,
  showAddButton = true,
}: RecommendationProductTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryImage =
    product.images?.length && product.images[0] && !imageFailed
      ? String(product.images[0]).trim()
      : '';

  useEffect(() => {
    setImageFailed(false);
  }, [product.id, product.images?.[0]]);

  const body = (
    <>
      <div className="w-full aspect-square rounded-lg bg-slate-50 flex items-center justify-center text-2xl mb-2 overflow-hidden">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-2xl">{product.emoji || '🐾'}</span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-900 line-clamp-2 min-h-[2.5rem]">
        {product.name}
      </p>
      <p className="text-sm font-bold text-[#FF8C42] mt-1">₹{product.price}</p>
      {showAddButton && onAdd ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="mt-2 w-full text-xs font-semibold py-1.5 rounded-lg border border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
        >
          Add
        </button>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="snap-start shrink-0 w-36 rounded-xl border border-slate-100 p-2 text-left hover:border-slate-200 transition-colors"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="snap-start shrink-0 w-36 rounded-xl border border-slate-100 p-2">
      {body}
    </div>
  );
}
