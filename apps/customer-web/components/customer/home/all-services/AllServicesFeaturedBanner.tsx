'use client';

import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { CustomerPlacementBanners } from '../../shared/CustomerPlacementBanners';

export interface AllServicesFeaturedBannerProps {
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

function AllServicesFeaturedBannerComponent({ onNavigate }: AllServicesFeaturedBannerProps) {
  const handleNavigate = onNavigate
    ? (screen: string, data?: unknown) => onNavigate(screen, data as Record<string, unknown> | undefined)
    : undefined;

  return (
    <div className="relative -mx-4 mb-2">
      <div className="pointer-events-none absolute left-4 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
        <Sparkles className="h-4 w-4 text-[#FF8C42]" aria-hidden />
      </div>
      <CustomerPlacementBanners
        placement="category"
        onNavigate={handleNavigate}
        shellClassName="h-[168px] rounded-none shadow-none ring-0"
        className="[&_h3]:text-base [&_h3]:font-extrabold [&_h3]:tracking-tight [&_button]:shadow-sm [&_button]:transition-transform [&_button]:hover:scale-[1.02]"
      />
    </div>
  );
}

export const AllServicesFeaturedBanner = memo(AllServicesFeaturedBannerComponent);
