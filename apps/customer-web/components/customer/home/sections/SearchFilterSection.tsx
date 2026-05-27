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

    <div className={`px-4 mt-5 mb-3 flex gap-2 items-start ${className}`}>

      <div className="flex-1 min-w-0">

        <EnhancedSearchBar

          placeholder={placeholder}

          customerId={customerId}

          onSearch={onSearch}

          onResultSelect={onResultSelect}

          className="shadow-sm"

        />

      </div>

      <button

        type="button"

        onClick={() => router.push('/search')}

        className="shrink-0 flex h-[46px] w-[46px] items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 active:scale-95 transition-all"

        aria-label="Open search and filters"

      >

        <SlidersHorizontal className="w-5 h-5 text-gray-600" />

      </button>

    </div>

  );

}



/** Universal search bar section — reuses EnhancedSearchBar with existing routing handlers. */

export const SearchFilterSection = memo(SearchFilterSectionComponent);

