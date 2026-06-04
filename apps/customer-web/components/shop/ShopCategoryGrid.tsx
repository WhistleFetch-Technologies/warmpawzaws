'use client';

import { Package } from 'lucide-react';
import type { ShopCategory } from './shop-types';

interface ShopCategoryGridProps {
  categories: ShopCategory[];
  selectedCategory?: string;
  onSelectCategory: (id: string) => void;
  /** When true, omit outer section title (e.g. home already has "Shop Pet Products"). */
  embedded?: boolean;
  /** Non-interactive muted tiles (e.g. marketplace gated off in prod). */
  disabled?: boolean;
  className?: string;
}

function CategoryTile({
  cat,
  index,
  active,
  disabled,
  onSelectCategory,
}: {
  cat: ShopCategory;
  index: number;
  active: boolean;
  disabled: boolean;
  onSelectCategory: (id: string) => void;
}) {
  const imageBlock = (
    <div className="relative mb-1 w-full aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-stone-50 to-orange-50/40">
      {cat.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cat.image_url}
          alt={cat.name}
          className={`h-full w-full object-cover ${disabled ? 'grayscale' : ''}`}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="h-9 w-9 text-stone-300" aria-hidden />
        </div>
      )}
    </div>
  );

  const label = (
    <span
      className={`w-full px-0.5 pb-0.5 text-center text-[10px] font-bold leading-[1.2] line-clamp-2 ${
        disabled ? 'text-slate-500' : active ? 'text-[#FF8C42]' : 'text-slate-800'
      }`}
    >
      {cat.name}
    </span>
  );

  if (disabled) {
    return (
      <div
        className="pointer-events-none flex w-full select-none flex-col items-center overflow-hidden rounded-2xl border border-stone-200/90 bg-white px-1.5 pt-1.5 pb-1.5 opacity-60 shadow-sm"
        aria-disabled="true"
        aria-label={cat.name}
      >
        {imageBlock}
        {label}
      </div>
    );
  }

  return (
    <button
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
      {imageBlock}
      {label}
    </button>
  );
}

export function ShopCategoryGrid({
  categories,
  selectedCategory,
  onSelectCategory,
  embedded = false,
  disabled = false,
  className = '',
}: ShopCategoryGridProps) {
  if (categories.length === 0) return null;

  const grid = (
    <div className="grid grid-cols-4 gap-3 sm:gap-3">
      {categories.map((cat, index) => (
        <CategoryTile
          key={cat.id}
          cat={cat}
          index={index}
          active={selectedCategory === cat.id}
          disabled={disabled}
          onSelectCategory={onSelectCategory}
        />
      ))}
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
