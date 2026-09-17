'use client';

import type { CatalogServiceCategory } from '@/lib/promo-engine/catalog-categories';

export function ServiceCategoryChips({
  categories,
  selected,
  loading,
  error,
  emptyHint,
  onToggle,
}: {
  categories: CatalogServiceCategory[];
  selected: string[];
  loading?: boolean;
  error?: string | null;
  emptyHint?: string;
  onToggle: (slug: string) => void;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading catalogue categories…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!categories.length) {
    return (
      <p className="text-sm text-slate-500">
        {emptyHint || 'No catalogue categories found. Add them in Admin → Catalogue → Categories.'}
      </p>
    );
  }

  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const on = selectedSet.has(category.slug);
        return (
          <button
            key={category.slug}
            type="button"
            onClick={() => onToggle(category.slug)}
            className={`min-h-10 rounded-full border px-3.5 py-2 text-sm font-medium ${
              on
                ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
