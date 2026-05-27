'use client';

import React, { memo } from 'react';
import type { PetTypeFilter } from './useAllServicesData';

const PET_FILTERS: { id: PetTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dogs', label: 'Dogs' },
  { id: 'cats', label: 'Cats' },
  { id: 'birds', label: 'Birds' },
  { id: 'other', label: 'Other' },
];

export interface CategoryFilterChipsProps {
  selected: PetTypeFilter;
  onChange: (filter: PetTypeFilter) => void;
  className?: string;
}

function CategoryFilterChipsComponent({
  selected,
  onChange,
  className = '',
}: CategoryFilterChipsProps) {
  return (
    <div className={`mb-5 ${className}`}>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {PET_FILTERS.map(({ id, label }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={`Filter services for ${label}`}
              onClick={() => onChange(id)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#FF8C42] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:opacity-90'
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

/** Pet-type filter chips — client-side filter for All Services. */
export const CategoryFilterChips = memo(CategoryFilterChipsComponent);
