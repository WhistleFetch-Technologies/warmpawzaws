'use client';

import { ArrowLeft, Heart } from 'lucide-react';
import { markWishlistOpenedFromShop } from '@/lib/go-back-or-replace';

interface ShopPageHeaderProps {
  onBack: () => void;
}

export function ShopPageHeader({ onBack }: ShopPageHeaderProps) {
  return (
    <div className="relative flex items-center min-w-0 min-h-[2.75rem]">
      <button
        type="button"
        onClick={onBack}
        className="relative z-10 shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <h1 className="pointer-events-none absolute inset-x-0 text-center text-base font-bold text-slate-900 truncate px-12">
        Pet Products
      </h1>

      <a
        href="/wishlist"
        onClick={() => markWishlistOpenedFromShop()}
        className="relative z-10 ml-auto shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform"
        aria-label="Wishlist"
      >
        <Heart className="w-5 h-5" />
      </a>
    </div>
  );
}
