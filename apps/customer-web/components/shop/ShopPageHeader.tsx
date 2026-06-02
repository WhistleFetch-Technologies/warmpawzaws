'use client';

import { ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { markWishlistOpenedFromShop } from '@/lib/go-back-or-replace';

interface ShopPageHeaderProps {
  onBack: () => void;
  cartItemCount: number;
  onOpenCart: () => void;
}

export function ShopPageHeader({ onBack, cartItemCount, onOpenCart }: ShopPageHeaderProps) {
  return (
    <div className="flex items-center gap-2 min-w-0 min-h-[2.75rem]">
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <h1 className="flex-1 text-center text-base font-bold text-slate-900 truncate px-1">
        Pet Products
      </h1>

      <a
        href="/wishlist"
        onClick={() => markWishlistOpenedFromShop()}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform"
        aria-label="Wishlist"
      >
        <Heart className="w-5 h-5" />
      </a>

      <button
        type="button"
        onClick={onOpenCart}
        className="relative shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform"
        aria-label="Open cart"
      >
        <ShoppingCart className="w-5 h-5" />
        {cartItemCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {cartItemCount > 99 ? '99+' : cartItemCount}
          </span>
        )}
      </button>
    </div>
  );
}
