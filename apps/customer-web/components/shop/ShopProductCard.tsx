'use client';

import React from 'react';
import { canonicalProductId } from '@/lib/product-id';
import { WishlistProductHeartButton } from '@/components/customer/WishlistProductHeartButton';
import { ShopCartQuantityControl } from './ShopCartQuantityControl';
import type { ShopProduct } from './shop-types';
import { getProductDiscountPercent } from './map-shop-product';

const PRODUCT_CARD_SHADOW =
  'shadow-[0_2px_6px_rgba(15,23,42,0.22),0_8px_24px_rgba(15,23,42,0.14)]';

interface ShopProductCardProps {
  product: ShopProduct;
  variant: 'deal' | 'grid';
  cartQuantity: number;
  onAddToCart: () => void;
  onQuantityChange: (quantity: number) => void;
}

export function ShopProductCard({
  product,
  variant,
  cartQuantity,
  onAddToCart,
  onQuantityChange,
}: ShopProductCardProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const wishlistPid = canonicalProductId(product as unknown as Record<string, unknown>) || product.id;
  const primaryImage =
    product.images?.length && product.images[0] && !imageFailed
      ? String(product.images[0]).trim()
      : '';

  React.useEffect(() => {
    setImageFailed(false);
  }, [product.id, product.images?.[0]]);

  const discount = getProductDiscountPercent(product);
  const outOfStock = product.stock === 0;

  const handleCardClick = () => {
    window.location.href = `/shop/${wishlistPid}`;
  };

  if (variant === 'deal') {
    return (
      <div
        className={`relative shrink-0 w-[9.5rem] bg-white rounded-2xl border border-slate-100 overflow-hidden ${PRODUCT_CARD_SHADOW} cursor-pointer active:scale-[0.98] transition-transform ${
          outOfStock ? 'opacity-90' : ''
        }`}
        onClick={handleCardClick}
      >
        <div className="relative aspect-square bg-gradient-to-b from-slate-50 to-white p-3">
          {discount > 0 && !outOfStock && (
            <span className="absolute top-2 left-2 z-[1] px-1.5 py-0.5 rounded-md bg-[#FF8C42] text-white text-[9px] font-bold">
              {discount}% OFF
            </span>
          )}
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">
              {product.emoji || '🐾'}
            </div>
          )}
          <ShopCartQuantityControl
            variant="deal"
            quantity={cartQuantity}
            disabled={outOfStock}
            onAdd={onAddToCart}
            onQuantityChange={onQuantityChange}
          />
        </div>
        <div className="px-2.5 pb-3 pt-1">
          <h3 className="text-[11px] font-semibold text-slate-900 line-clamp-2 leading-snug min-h-[2.25rem]">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-slate-900 tabular-nums">₹{product.price}</span>
            {discount > 0 && product.original_price != null && (
              <span className="text-[10px] text-slate-400 line-through tabular-nums">
                ₹{product.original_price}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100/90 overflow-hidden ${PRODUCT_CARD_SHADOW} active:scale-[0.98] transition-transform duration-150 cursor-pointer min-w-0 w-full max-w-full flex flex-col h-full min-h-0 ${
        outOfStock ? 'opacity-90' : ''
      }`}
      onClick={handleCardClick}
    >
      <div
        className={`relative aspect-square w-full shrink-0 bg-gradient-to-b from-slate-100 to-slate-50 overflow-hidden ${
          outOfStock ? 'grayscale-[0.35]' : ''
        }`}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl select-none">
            {product.emoji || '📦'}
          </div>
        )}

        <WishlistProductHeartButton
          productId={wishlistPid}
          visualVariant="shop-floating"
          className="absolute top-2 right-2 w-8 h-8"
        />

        {discount > 0 && !outOfStock && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#FF8C42] text-white text-[10px] font-bold rounded-md shadow-sm">
            {discount}% OFF
          </div>
        )}

        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-md">
            {product.stock} left
          </div>
        )}

        {outOfStock && (
          <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none z-[1]">
            <span className="px-2.5 py-1 rounded-full bg-slate-900/85 text-white text-[10px] font-bold tracking-wide backdrop-blur-sm">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 p-2.5 pt-2 gap-1">
        <h3 className="font-semibold text-slate-900 text-xs leading-snug line-clamp-2">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-slate-900 tabular-nums">₹{product.price}</span>
          {discount > 0 && product.original_price != null && (
            <span className="text-[10px] text-slate-400 line-through tabular-nums">
              ₹{product.original_price}
            </span>
          )}
        </div>

        <ShopCartQuantityControl
          variant="grid"
          quantity={cartQuantity}
          disabled={outOfStock}
          onAdd={onAddToCart}
          onQuantityChange={onQuantityChange}
        />
      </div>
    </div>
  );
}
