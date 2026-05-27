'use client';

import React, { memo } from 'react';
import { Wheat } from 'lucide-react';
import { petFoodSpotlightBrands } from '../../homepage/constants/helpers';

export interface PremiumPetFoodSectionProps {
  className?: string;
}

function PremiumPetFoodSectionComponent({ className = '' }: PremiumPetFoodSectionProps) {
  const brands = petFoodSpotlightBrands();

  return (
    <div className={`mb-6 ${className}`} aria-label="Premium Pet Food — coming soon">
      <div className="mb-4 px-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Wheat className="h-5 w-5 shrink-0 text-yellow-600" />
            <h2 className="font-semibold text-black">Premium Pet Food</h2>
          </div>
          <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Soon
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Coming soon — trusted brands and vendor deals when we launch. Browse the shop for food then.
        </p>
      </div>
      <div className="pointer-events-none flex gap-4 overflow-x-auto px-4 scrollbar-hide select-none">
        {brands.map((vendor, index) => (
          <div
            key={index}
            className="w-32 flex-shrink-0 rounded-2xl border border-yellow-100 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 text-center opacity-[0.92] grayscale-[0.08]"
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100">
              <vendor.Icon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">{vendor.name}</h3>
            <span className="inline-block text-xs font-semibold text-amber-600">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const PremiumPetFoodSection = memo(PremiumPetFoodSectionComponent);
