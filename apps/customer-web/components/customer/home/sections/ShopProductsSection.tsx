'use client';

import React, { memo, useCallback } from 'react';
import { Plus, ShoppingBag, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { useCart } from '@/context/CartContext';
import { hasRatings, normalizeRatingCount } from '@/lib/rating-display';
import { SectionHeader } from '../shared/SectionHeader';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import { ShopCategoryGrid } from '@/components/shop/ShopCategoryGrid';
import type { ShopCategory as ShopCategoryTile } from '@/components/shop/shop-types';
import { STATIC_SHOP_DISPLAY_CATEGORIES } from '@/lib/shop-category-static-images';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface ShopHotDeal {
  id?: string;
  title: string;
  price: string;
  originalPrice?: string | null;
  discount?: string | null;
  rating?: number;
  reviewCount?: number;
  /** Numeric price for cart — parsed from API when available */
  priceValue?: number;
  image?: string;
}

export interface ShopCategory {
  id: string;
  name: string;
  image_url?: string;
  icon?: string;
  display_order?: number;
}

export interface ShopProductsSectionProps {
  hotDeals: ShopHotDeal[];
  categories: ShopCategory[];
  ecommerceEnabled: boolean;
  onNavigate: HomeNavigateFn;
  className?: string;
}

function parsePriceValue(deal: ShopHotDeal): number {
  if (typeof deal.priceValue === 'number' && deal.priceValue > 0) return deal.priceValue;
  const digits = String(deal.price ?? '').replace(/[^\d.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function ShopProductsSectionComponent({
  hotDeals,
  categories,
  ecommerceEnabled,
  onNavigate,
  className = '',
}: ShopProductsSectionProps) {
  const { addToCart } = useCart();

  const handleAddToCart = useCallback(
    (deal: ShopHotDeal, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!ecommerceEnabled) {
        toast.info('Shop is coming soon.');
        return;
      }
      const price = parsePriceValue(deal);
      if (!deal.id) {
        onNavigate('shop');
        return;
      }
      addToCart({
        id: String(deal.id),
        name: deal.title,
        price: price || 999,
        quantity: 1,
        image: deal.image,
      });
      toast.success(`${deal.title} added to cart`);
    },
    [addToCart, ecommerceEnabled, onNavigate]
  );

  const visibleDeals = ecommerceEnabled ? hotDeals : [];
  const displayCategories = (
    categories.length > 0 ? categories : STATIC_SHOP_DISPLAY_CATEGORIES
  ) as ShopCategoryTile[];

  return (
    <div className={`mb-6 ${className}`}>
      <SectionHeader
        title="Shop Pet Products"
        icon={<ShoppingBag className="h-4 w-4 text-[#FF8C42]" />}
        actionLabel={ecommerceEnabled ? 'View all' : undefined}
        onAction={ecommerceEnabled ? () => onNavigate('shop') : undefined}
      />

      <ShopCategoryGrid
        embedded
        disabled={!ecommerceEnabled}
        categories={displayCategories}
        onSelectCategory={
          ecommerceEnabled ? (id) => onNavigate('shop', { category: id }) : () => {}
        }
      />

      {visibleDeals.length > 0 ? (
        <HorizontalScrollRow gapClassName="gap-3" paddingClassName="px-4" className="mt-3">
          {visibleDeals.map((deal, index) => (
            <div
              key={deal.id || index}
              className="w-44 flex-shrink-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onNavigate('shop')}
              >
                <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                  {deal.image ? (
                    <PresignableImage
                      src={deal.image}
                      alt={deal.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-gray-300" aria-hidden />
                  )}
                </div>
                <p className="mb-1 line-clamp-2 text-xs font-semibold text-gray-900">{deal.title}</p>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#FF8C42]">{deal.price}</span>
                  {deal.discount ? (
                    <span className="text-[10px] font-medium text-green-600">{deal.discount}</span>
                  ) : null}
                </div>
                {hasRatings(normalizeRatingCount(deal.reviewCount)) &&
                deal.rating != null &&
                Number(deal.rating) > 0 ? (
                  <div className="mb-2 flex items-center gap-0.5 text-[10px] text-gray-500">
                    <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                    {Number(deal.rating).toFixed(1)}
                  </div>
                ) : null}
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 rounded-full bg-[#FF8C42] py-1.5 text-[10px] font-medium text-white active:opacity-90"
                onClick={(e) => handleAddToCart(deal, e)}
              >
                <Plus className="h-3 w-3" />
                Add to cart
              </button>
            </div>
          ))}
        </HorizontalScrollRow>
      ) : null}
    </div>
  );
}

/** Shop categories + featured products — image grid; disabled when ecommerce is off. */
export const ShopProductsSection = memo(ShopProductsSectionComponent);
