'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import {
  adaptWpayNearbyVendorsToWalkInProviders,
  buildWpayNearbyVendorsUrl,
  type WpayNearbyVendorsResponse,
} from '@/lib/adapt-wpay-nearby-vendors';
import {
  resolveCustomerDiscoveryCoords,
  resolveCustomerDiscoveryPhone,
} from '@/lib/customer-discovery-coords';
import { type FeaturedProviderCategory } from '@/lib/featured-provider';
import { type WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import {
  WalkInProviderCard,
  WalkInProviderCardSkeleton,
} from './WalkInProviderCard';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const WALK_IN_SECTION_SUBTITLE =
  'Pay with Warmpawz and get a discount on your total bill.';

function WalkInSectionHeader({ onViewAll }: { onViewAll: () => void }) {
  return (
    <div className="px-4">
      <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-3">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
          <h2 className="truncate text-sm font-semibold text-gray-900">
            Walk-in Services Near You
          </h2>
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
export const WALK_IN_NEAR_YOU_CATEGORIES: FeaturedProviderCategory[] = [
  'vet',
  'grooming',
];

const NEARBY_LIMIT = 8;

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
  const router = useRouter();
  const [loading, setLoading] = useState(enabled);
  const [providers, setProviders] = useState<WalkInProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const discoveryPhone = resolveCustomerDiscoveryPhone(phone);
        const coords = await resolveCustomerDiscoveryCoords(discoveryPhone);
        const { latitude, longitude } = coords;

        if (!latitude || !longitude) {
          if (cancelled) return;
          setProviders([]);
          setError(null);
          return;
        }

        const response = await apiClient.get<WpayNearbyVendorsResponse>(
          buildWpayNearbyVendorsUrl({
            limit: NEARBY_LIMIT,
            latitude,
            longitude,
            phone: discoveryPhone || undefined,
          })
        );

        if (cancelled) return;

        const mapped = adaptWpayNearbyVendorsToWalkInProviders(response, {
          limit: NEARBY_LIMIT,
        });
        setProviders(mapped);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setProviders([]);
        setError(e instanceof Error ? e.message : 'Failed to load walk-in services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [phone, enabled]);

  const handleViewAll = useCallback(() => {
    onNavigate('/search');
  }, [onNavigate]);

  const handlePayNow = useCallback(
    (provider: WalkInProvider) => {
      const vendorId = String(provider.id ?? '').trim();
      if (!vendorId) return;
      // nav-exception: WPay module uses URL routes (same entry as Pay Hub vendor list → Pay Bill)
      launchWarmpawzPayServiceBooking({
        router,
        serviceKey: provider.category,
        category: provider.category,
        vendorId,
      });
    },
    [router]
  );

  const header = useMemo(
    () => <WalkInSectionHeader onViewAll={handleViewAll} />,
    [handleViewAll]
  );

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <section className={`mb-6 mt-6 ${className}`} aria-label="Walk-in services near you">
        {header}
        <WalkInNearYouSectionSkeleton />
      </section>
    );
  }

  if (error && providers.length === 0) {
    return null;
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <section className={`mb-6 mt-6 ${className}`} aria-label="Walk-in services near you">
      {header}
      <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-3 pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
        {providers.map((provider) => (
          <WalkInProviderCard
            key={provider.id}
            provider={provider}
            onSelect={() => handlePayNow(provider)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Nearby walk-in (at_center) vendors — vet + grooming.
 */
export const WalkInNearYouSection = memo(WalkInNearYouSectionComponent);
