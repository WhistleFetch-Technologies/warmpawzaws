'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { canonicalProductId } from '@/lib/product-id';
import { WishlistProductHeartButton } from '@/components/customer/WishlistProductHeartButton';
import { ShopCartQuantityControl } from './ShopCartQuantityControl';
import type { ShopProduct } from './shop-types';
import { getProductDiscountPercent } from './map-shop-product';
import { MarketplaceCard } from '@/components/customer/marketplace/MarketplaceCard';

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
  const router = useRouter();
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
  const pricePrefix = product.price_from ? 'From ' : '';
  const hasDiscount = discount > 0 && product.original_price != null;
  const savingsAmount = hasDiscount ? product.original_price! - product.price : undefined;

  const handleCardClick = () => {
    const pid = (wishlistPid || product.id || '').trim();
    if (!pid) return;
    router.push(`/shop/${encodeURIComponent(pid)}`);
  };

  const cartControl = (
    <ShopCartQuantityControl
      variant={variant}
      quantity={cartQuantity}
      disabled={outOfStock}
      onAdd={onAddToCart}
      onQuantityChange={onQuantityChange}
    />
  );

  const imageOverlay =
    variant === 'grid' ? (
      <>
        <WishlistProductHeartButton
          productId={wishlistPid}
          visualVariant="shop-floating"
          className="absolute top-2 right-2 z-[2] w-8 h-8"
        />
        {cartControl}
      </>
    ) : (
      cartControl
    );

  const priceSlot =
    !hasDiscount && pricePrefix ? (
      <p className="text-sm font-bold text-slate-900 tabular-nums">
        {pricePrefix}₹{product.price}
      </p>
    ) : undefined;

  return (
    <MarketplaceCard
      domain="product"
      id={product.id}
      imageUrl={primaryImage || undefined}
      imageFallback={product.emoji || (variant === 'deal' ? '🐾' : '📦')}
      title={product.name}
      originalPrice={hasDiscount ? product.original_price : undefined}
      currentPrice={product.price}
      savingsAmount={savingsAmount}
      availability={outOfStock ? 'unavailable' : product.stock <= 5 && product.stock > 0 ? 'limited' : 'available'}
      availabilityLabel={
        outOfStock
          ? 'Out of stock'
          : product.stock <= 5 && product.stock > 0
            ? `${product.stock} left`
            : undefined
      }
      layout="vertical"
      onClick={handleCardClick}
      imageOverlay={imageOverlay}
      priceSlot={priceSlot}
      className={`${PRODUCT_CARD_SHADOW} ${outOfStock ? 'opacity-90' : ''} ${
        variant === 'deal' ? 'shrink-0 w-[9.5rem]' : 'min-w-0 w-full max-w-full h-full min-h-0'
      } ${variant === 'grid' && outOfStock ? ' [&_img]:grayscale-[0.35]' : ''}`}
    />
  );
}
