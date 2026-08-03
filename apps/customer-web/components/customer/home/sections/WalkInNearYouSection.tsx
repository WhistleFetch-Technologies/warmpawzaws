'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { type FeaturedProviderCategory } from '@/lib/featured-provider';
import { type WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import {
  useWalkInNearbyProviders,
  WALK_IN_NEARBY_HOME_LIMIT,
} from '@/hooks/useWalkInNearbyProviders';
import { useWalkInVendorActions } from '@/lib/walk-in-vendor-actions';
import {
  WALK_IN_SECTION_SUBTITLE,
  WALK_IN_SECTION_TITLE,
  WALK_IN_VENDORS_PATH,
} from '@/lib/walk-in-constants';
import {
  WalkInProviderCard,
  WalkInProviderCardSkeleton,
} from './WalkInProviderCard';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

function WalkInSectionHeader({ onViewAll }: { onViewAll: () => void }) {
  return (
    <div className="px-4">
      <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-3">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
          <h2 className="truncate text-sm font-semibold text-gray-900">{WALK_IN_SECTION_TITLE}</h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="col-start-2 row-start-1 shrink-0 self-center text-[11px] font-medium text-[#FF8C42]"
        >
          View all
        </button>
        <p className="col-start-1 row-start-2 mt-1 mb-3 ml-7 text-xs font-normal leading-[18px] text-gray-500">
          {WALK_IN_SECTION_SUBTITLE}
        </p>
      </div>
    </div>
  );
}

/** Phase 1 walk-in categories (vet + grooming). Training deferred to a later step. */
export const WALK_IN_NEAR_YOU_CATEGORIES: FeaturedProviderCategory[] = ['vet', 'grooming'];

export interface WalkInNearYouSectionProps {
  phone?: string;
  onNavigate: HomeNavigateFn;
  className?: string;
  /** When false, skips fetch (e.g. section not yet visible). Default true. */
  enabled?: boolean;
}

function WalkInNearYouSectionSkeleton() {
  return (
    <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-3 pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
      {[0, 1, 2].map((i) => (
        <WalkInProviderCardSkeleton key={i} />
      ))}
    </div>
  );
}

function WalkInNearYouSectionComponent({
  phone,
  onNavigate,
  className = '',
  enabled = true,
}: WalkInNearYouSectionProps) {
  const { data: providers = [], isLoading, isError } = useWalkInNearbyProviders({
    phone,
    enabled,
  });
  const { payBill, bookNow } = useWalkInVendorActions(onNavigate);

  const carouselProviders = useMemo(
    () => providers.slice(0, WALK_IN_NEARBY_HOME_LIMIT),
    [providers]
  );

  const handleViewAll = useCallback(() => {
    onNavigate(WALK_IN_VENDORS_PATH);
  }, [onNavigate]);

  const header = useMemo(
    () => <WalkInSectionHeader onViewAll={handleViewAll} />,
    [handleViewAll]
  );

  if (!enabled) {
    return null;
  }

  if (isLoading && carouselProviders.length === 0) {
    return (
      <section className={`mb-6 mt-6 ${className}`} aria-label="Walk-in services near you">
        {header}
        <WalkInNearYouSectionSkeleton />
      </section>
    );
  }

  if (isError && carouselProviders.length === 0) {
    return null;
  }

  if (carouselProviders.length === 0) {
    return null;
  }

  return (
    <section className={`mb-6 mt-6 ${className}`} aria-label="Walk-in services near you">
      {header}
      <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-3 pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
        {carouselProviders.map((provider) => (
          <WalkInProviderCard
            key={provider.id}
            provider={provider}
            onSelect={() => payBill(provider)}
            onBook={() => bookNow(provider)}
          />
        ))}
      </div>
    </section>
  );
}

/** Nearby walk-in (at_center) vendors — vet + grooming. */
export const WalkInNearYouSection = memo(WalkInNearYouSectionComponent);
