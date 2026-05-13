'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { goBackOrHome } from '@/lib/go-back-or-replace';

export default function WishlistPage() {
  const router = useRouter();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
      <button
        type="button"
        onClick={() => goBackOrHome(router)}
        className="absolute left-4 top-4 rounded-lg bg-white/90 p-2 shadow-sm"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-gray-700" />
      </button>
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <Heart className="mx-auto mb-4 h-16 w-16 text-red-200" />
        <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
        <p className="text-gray-500">
          Saved items and wishlist will be available when the marketplace launches.
        </p>
      </div>
    </div>
  );
}
