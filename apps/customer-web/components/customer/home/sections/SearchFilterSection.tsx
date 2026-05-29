'use client';

import React, { memo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { EnhancedSearchBar } from '../../EnhancedSearchBar';

export interface SearchFilterSectionProps {
  customerId?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onResultSelect?: (result: Parameters<NonNullable<React.ComponentProps<typeof EnhancedSearchBar>['onResultSelect']>>[0]) => void;
  className?: string;
}

function SearchFilterSectionComponent({
  customerId,
  placeholder = 'Search services, products, vets, groomers...',
  onSearch,
  onResultSelect,
  className = '',
}: SearchFilterSectionProps) {
  const router = useRouter();

  return (
    <div className={`px-4 mt-[14px] mb-3 flex gap-2 items-center ${className}`}>
      <div className="min-w-0 flex-1">
        <EnhancedSearchBar
          placeholder={placeholder}
          customerId={customerId}
          onSearch={onSearch}
          onResultSelect={onResultSelect}
          compact
          className="shadow-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => router.push('/search')}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        aria-label="Open search and filters"
      >
        <SlidersHorizontal className="h-4 w-4 text-gray-600" />
      </button>
    </div>
  );
}



/** Universal search bar section — reuses EnhancedSearchBar with existing routing handlers. */

export const SearchFilterSection = memo(SearchFilterSectionComponent);

