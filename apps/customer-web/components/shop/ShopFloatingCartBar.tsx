'use client';

import { ChevronRight } from 'lucide-react';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { SHOP_FLOATING_CART_BOTTOM } from '@/lib/ecommerce/ecommerce-page-shell';
import type { ShopCartItem } from './shop-types';

/** Product detail and other full-screen routes without a tab bar. */
export const STANDALONE_FLOATING_CART_BOTTOM =
  'bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]';

type ShopFloatingCartBarProps = {
  itemCount: number;
  /** Shop listing cart lines (optional when `previewImage` / `previewEmoji` supplied). */
  cart?: ShopCartItem[];
  previewImage?: string;
  previewEmoji?: string;
  bottomClassName?: string;
};

export function ShopFloatingCartBar({
  cart,
  itemCount,
  previewImage,
  previewEmoji,
  bottomClassName = SHOP_FLOATING_CART_BOTTOM,
}: ShopFloatingCartBarProps) {
  const nav = useCustomerNavigation();

  if (itemCount <= 0) return null;

  const first = cart?.[0];
  const thumb = previewImage ?? first?.product?.images?.[0];
  const emoji = previewEmoji ?? first?.product?.emoji;
  const label = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4 ${bottomClassName}`}
    >
      <button
        type="button"
        onClick={() => nav.goToCart()}
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-lg shadow-emerald-600/25 transition-all duration-300"
        aria-label="View cart"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/20 flex items-center justify-center">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">{emoji || '🐾'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold leading-tight">View cart</p>
          <p className="text-xs text-emerald-100">{label}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <ChevronRight className="h-5 w-5" />
        </div>
      </button>
    </div>
  );
}
