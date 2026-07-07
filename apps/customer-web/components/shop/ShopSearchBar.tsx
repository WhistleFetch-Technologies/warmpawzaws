'use client';

import { Filter, Search } from 'lucide-react';
import { SHOP_SORT_LABELS } from './shop-types';

interface ShopSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  hasActivePriceFilter: boolean;
  onOpenFilters: () => void;
}

export function ShopSearchBar({
  searchTerm,
  onSearchChange,
  sortBy,
  hasActivePriceFilter,
  onOpenFilters,
}: ShopSearchBarProps) {
  const sortLabel = SHOP_SORT_LABELS[sortBy] || 'Sort';
  const filterActive = hasActivePriceFilter || sortBy !== 'popular';

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          placeholder="Search food, toys, accessories…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 text-[16px] rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/25 focus:border-[#FF8C42] transition-colors"
        />
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        className={`shrink-0 inline-flex max-w-[9.5rem] items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold border active:scale-[0.98] transition-transform ${
          filterActive
            ? 'text-white bg-[#FF8C42] border-[#FF8C42]'
            : 'text-[#FF8C42] bg-orange-50 border-orange-100 active:bg-orange-100'
        }`}
        aria-label={`Filters: ${sortLabel}`}
      >
        <Filter className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{filterActive ? sortLabel : 'Filters'}</span>
      </button>
    </div>
  );
}
