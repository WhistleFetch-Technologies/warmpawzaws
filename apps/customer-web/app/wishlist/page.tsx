'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { Heart, ArrowLeft } from 'lucide-react';

export default function WishlistPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] min-h-screen w-full max-w-customer mx-auto bg-gradient-to-br from-slate-50 to-orange-50/30 flex flex-col relative">
      <header className="sticky top-0 z-40 shrink-0 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur-md cw-header-safe-top">
        <div className="px-3 py-3 flex items-center gap-2 min-h-[52px]">
          <button
            type="button"
            onClick={() => goBackOrHome(router)}
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl active:bg-slate-100 text-slate-700"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
              <Heart className="w-5 h-5 text-red-500 fill-red-500 shrink-0" />
              <span className="truncate">My Wishlist</span>
            </h1>
            <p className="text-[13px] text-orange-600 font-medium">Coming soon</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-orange-100 shadow-sm px-5 py-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Coming soon</h2>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            Wishlist is on the way. You&apos;ll be able to save your favorite products here soon.
          </p>
        </div>
      </main>
    </div>
  );
}
