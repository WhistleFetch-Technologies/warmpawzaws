'use client';

import React, { memo, useCallback } from 'react';
import { Wheat } from 'lucide-react';
import { petFoodSpotlightBrands } from '../../homepage/constants/helpers';
import { SectionHeader } from '../shared/SectionHeader';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface PremiumPetFoodSectionProps {
  className?: string;
  onNavigate?: HomeNavigateFn;
  /** Resolved Pet Food category UUID from storefront API; falls back to plain /shop when unset. */
  petFoodCategoryId?: string;
}

function PremiumPetFoodSectionComponent({
  className = '',
  onNavigate,
  petFoodCategoryId,
}: PremiumPetFoodSectionProps) {
  const brands = petFoodSpotlightBrands();

  const openFoodShop = useCallback(() => {
    onNavigate?.('shop', petFoodCategoryId ? { category: petFoodCategoryId } : undefined);
  }, [onNavigate, petFoodCategoryId]);

  return (
    <div className={`mb-6 ${className}`} aria-label="Premium Pet Food">
      <SectionHeader
        title="Premium Pet Food"
        icon={<Wheat className="h-5 w-5 text-yellow-600" />}
        actionLabel="Browse shop"
        onAction={openFoodShop}
        className="px-4"
      />
      <p className="mb-3 px-4 text-xs text-gray-600">
        Trusted brands and vendor deals — shop food, treats, and nutrition essentials.
      </p>
      <HorizontalScrollRow gapClassName="gap-4" paddingClassName="px-4">
        {brands.map((vendor, index) => (
          <button
            key={index}
            type="button"
            onClick={openFoodShop}
            className="w-32 flex-shrink-0 rounded-2xl border border-yellow-100 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 text-center transition active:scale-[0.98]"
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100">
              <vendor.Icon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">{vendor.name}</h3>
            <span className="inline-block text-xs font-semibold text-[#FF8C42]">{vendor.discount}</span>
          </button>
        ))}
      </HorizontalScrollRow>
    </div>
  );
}

export const PremiumPetFoodSection = memo(PremiumPetFoodSectionComponent);
