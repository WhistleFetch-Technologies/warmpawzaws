'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { PetTypeFilter } from './useAllServicesData';

const PET_FILTERS: { id: PetTypeFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🐾' },
  { id: 'dogs', label: 'Dogs', emoji: '🐕' },
  { id: 'cats', label: 'Cats', emoji: '🐈' },
  { id: 'birds', label: 'Birds', emoji: '🦜' },
  { id: 'other', label: 'Other', emoji: '🐰' },
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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<PetTypeFilter, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const btn = buttonRefs.current.get(selected);
    const container = containerRef.current;
    if (!btn || !container) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - containerRect.left + container.scrollLeft,
      width: btnRect.width,
    });
  }, [selected]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div className={`mb-6 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Filter by pet
        </p>
      </div>
      <div
        ref={containerRef}
        className="relative flex gap-2 overflow-x-auto scrollbar-hide pb-1"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 h-full rounded-full bg-[#FF8C42] shadow-md shadow-orange-200/50 transition-all duration-300 ease-out"
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.width > 0 ? 1 : 0,
          }}
        />
        {PET_FILTERS.map(({ id, label, emoji }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) buttonRefs.current.set(id, el);
                else buttonRefs.current.delete(id);
              }}
              type="button"
              aria-pressed={active}
              aria-label={`Filter services for ${label}`}
              onClick={() => onChange(id)}
              className={`relative z-10 flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                active
                  ? 'text-white'
                  : 'bg-gray-50 text-gray-600 ring-1 ring-gray-100 hover:bg-gray-100 active:opacity-90'
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {emoji}
              </span>
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
