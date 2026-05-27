'use client';

import React, { memo, useCallback, type ReactNode } from 'react';
import { ArrowLeft, PawPrint, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TrustFeatureBar } from '../sections/TrustFeatureBar';
import { CategoryFilterChips } from './CategoryFilterChips';
import { ServiceCardLarge } from './ServiceCardLarge';
import { ServiceCardSmall } from './ServiceCardSmall';
import { useAllServicesData, type AllServicesTile } from './useAllServicesData';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';

export interface AllServicesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  topSlot?: ReactNode;
}

function AllServicesScreenComponent({
  phone,
  onBack,
  onNavigate,
  topSlot,
}: AllServicesScreenProps) {
  const router = useRouter();
  const {
    primaryServices,
    secondaryServices,
    petFilteredServices,
    petFilter,
    setPetFilter,
    loading,
  } = useAllServicesData({ phone });

  const handleServicePress = useCallback(
    (service: AllServicesTile) => {
      const screen = String(service.screen || '').toLowerCase();
      const key = String(service.categoryId || service.screen || '').toLowerCase();
      const isComingSoon =
        Boolean(service.isComingSoon) ||
        COMING_SOON_HOME_SERVICE_SCREENS.has(screen) ||
        COMING_SOON_HOME_SERVICE_SCREENS.has(key);

      if (isComingSoon) {
        toast.info('This service is coming soon in your area.');
        return;
      }

      if (screen === 'shop') {
        onNavigate('shop');
        return;
      }

      onNavigate(service.screen);
    },
    [onNavigate]
  );

  const showEmptyState = !loading && petFilteredServices.length === 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-customer flex-col bg-[#FF8C42]">
      <div className="flex-shrink-0 cw-header-safe-top cw-header-safe-x pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
              aria-label="Go back to home"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-white">All Services</h1>
              <p className="truncate text-sm text-white/80">Choose a service for your pet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/search')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
            aria-label="Open search"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-t-[32px] bg-white">
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6 pt-5">
          {topSlot ? <div className="mb-4">{topSlot}</div> : null}

          <CategoryFilterChips selected={petFilter} onChange={setPetFilter} />

          {loading ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-large-${i}`}
                    className="h-[140px] animate-pulse rounded-2xl bg-gray-100"
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`sk-small-${i}`} className="flex flex-col items-center gap-2">
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-gray-100" />
                    <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          ) : showEmptyState ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <PawPrint className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-700">No services for this pet type</p>
              <p className="mt-1 text-sm text-gray-500">
                Try another filter or choose All to see every service.
              </p>
            </div>
          ) : (
            <>
              {primaryServices.length > 0 ? (
                <section className="mb-6" aria-label="Services for You">
                  <h2 className="mb-3 font-semibold text-gray-900">Services for You</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {primaryServices.map((service, index) => (
                      <ServiceCardLarge
                        key={service.screen || index}
                        service={service}
                        onPress={handleServicePress}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {secondaryServices.length > 0 ? (
                <section className="mb-4" aria-label="More Services">
                  <h2 className="mb-3 font-semibold text-gray-900">More Services</h2>
                  <div className="grid grid-cols-4 gap-3">
                    {secondaryServices.map((service, index) => (
                      <ServiceCardSmall
                        key={service.screen || index}
                        service={service}
                        onPress={handleServicePress}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}

          <TrustFeatureBar onNavigate={onNavigate} className="mt-2 px-0" />
        </div>
      </div>
    </div>
  );
}

/** All Services catalog — replaces ProblemGridSelector when new home UI flag is on. */
export const AllServicesScreen = memo(AllServicesScreenComponent);
