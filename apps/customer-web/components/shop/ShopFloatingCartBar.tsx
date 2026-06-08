'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ShopCartItem } from './shop-types';

type ShopFloatingCartBarProps = {
  cart: ShopCartItem[];
  itemCount: number;
};

export function ShopFloatingCartBar({ cart, itemCount }: ShopFloatingCartBarProps) {
  const router = useRouter();

  if (itemCount <= 0) return null;

  const first = cart[0];
  const thumb = first?.product?.images?.[0];
  const label = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[var(--customer-floater-bottom)] z-[45] flex justify-center px-4">
      <button
        type="button"
        onClick={() => router.push('/cart')}
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-lg shadow-emerald-600/25 transition-all duration-300"
        aria-label="View cart"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/20 flex items-center justify-center">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">{first?.product?.emoji || '🐾'}</span>
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
