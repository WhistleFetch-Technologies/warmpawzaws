'use client';

import type { RefObject } from 'react';
import type { MealOrderFilterId } from '@/components/customer/meal-plans/meal-plan-order-display';

const FILTERS: { id: MealOrderFilterId; label: string }[] = [
  { id: 'all', label: 'All Orders' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'cancelled', label: 'Cancelled' },
];

export interface MealOrderFilterTabsProps {
  activeFilter: MealOrderFilterId;
  onFilterChange: (id: MealOrderFilterId) => void;
  filterRef?: RefObject<HTMLDivElement>;
}

export function MealOrderFilterTabs({
  activeFilter,
  onFilterChange,
  filterRef,
}: MealOrderFilterTabsProps) {
  return (
    <div
      ref={filterRef}
      className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none"
      role="tablist"
      aria-label="Filter meal orders"
    >
      <div className="flex min-w-max gap-2">
        {FILTERS.map(({ id, label }) => {
          const active = activeFilter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                active
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
