'use client';

import { Package } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import type { ShopCategory } from './shop-types';

interface ShopCategoryGridProps {
  categories: ShopCategory[];
  selectedCategory?: string;
  onSelectCategory: (id: string) => void;
  /** When true, omit outer section title (e.g. home already has "Shop Pet Products"). */
  embedded?: boolean;
  className?: string;
}

export function ShopCategoryGrid({
  categories,
  selectedCategory,
  onSelectCategory,
  embedded = false,
  className = '',
}: ShopCategoryGridProps) {
  if (categories.length === 0) return null;

  const grid = (
    <div className="grid grid-cols-4 gap-3 sm:gap-3">
        {categories.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex w-full flex-col items-center overflow-hidden rounded-2xl border bg-white px-1.5 pt-1.5 pb-1.5 shadow-sm transition-all active:scale-[0.98] ${
                active
                  ? 'border-[#FF8C42] shadow-md ring-2 ring-[#FF8C42]/25'
                  : 'border-stone-200/90 hover:border-stone-300 hover:shadow-md'
              }`}
              aria-pressed={active}
              aria-label={`Browse ${cat.name}`}
            >
              <div className="relative mb-1 w-full aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-stone-50 to-orange-50/40">
                {cat.image_url ? (
                  <PresignableImage
                    src={cat.image_url}
                    alt={cat.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-9 w-9 text-stone-300" aria-hidden />
                  </div>
                )}
              </div>
              <span
                className={`w-full px-0.5 pb-0.5 text-center text-[10px] font-bold leading-[1.2] line-clamp-2 ${
                  active ? 'text-[#FF8C42]' : 'text-slate-800'
                }`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
    </div>
  );

  if (embedded) {
    return (
      <div className={`px-4 py-1 ${className}`} aria-label="Shop by category">
        {grid}
      </div>
    );
  }

  return (
    <section className={`px-4 mt-4 ${className}`} aria-label="Shop by category">
      <h2 className="text-sm font-bold text-slate-900 mb-3">Shop by category</h2>
      {grid}
    </section>
  );
}
