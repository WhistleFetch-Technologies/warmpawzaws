'use client';

import React, { memo, useCallback, type ReactNode } from 'react';
import { ArrowLeft, PawPrint, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { isAppReviewDemoAccount } from '@/lib/app-review-demo-account';
import { AllServicesFeaturedBanner } from './AllServicesFeaturedBanner';
import { AllServicesTrustBar } from './AllServicesTrustBar';
import { CategoryFilterChips } from './CategoryFilterChips';
import { ServiceCardLarge } from './ServiceCardLarge';
import { ServiceCardSmall } from './ServiceCardSmall';
import { useAllServicesData, type AllServicesTile } from './useAllServicesData';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';

export interface AllServicesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  /** @deprecated Banner is rendered internally; kept for backward compatibility */
  topSlot?: ReactNode;
}

function SectionHeading({
  title,
  count,
  accent,
}: {
  title: string;
  count?: number;
  accent?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div
        className={`h-7 w-1 rounded-full ${accent ?? 'bg-gradient-to-b from-[#FF8C42] to-[#FF6B35]'}`}
        aria-hidden
      />
      <h2 className="flex-1 text-base font-bold tracking-tight text-gray-900">{title}</h2>
      {count != null && count > 0 ? (
        <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#FF8C42]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function AllServicesScreenComponent({
  phone,
  onBack,
  onNavigate,
  topSlot,
}: AllServicesScreenProps) {
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

      if (isAppReviewDemoAccount(phone) && (isComingSoon || screen === 'shop')) {
        return;
      }

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
    [onNavigate, phone]
  );

  const showEmptyState = !loading && petFilteredServices.length === 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-customer flex-col bg-[#FF8C42]">
      {/* Decorative header */}
      <div className="relative flex-shrink-0 overflow-hidden">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-white/5 blur-xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-8 top-12 opacity-[0.07]"
          aria-hidden
        >
          <PawPrint className="h-24 w-24 rotate-12 text-white" />
        </div>

        <div className="relative cw-header-safe-top cw-header-safe-x pb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md transition-all hover:bg-white/30 active:scale-95"
                aria-label="Go back to home"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xl font-extrabold tracking-tight text-white">
                    All Services
                  </h1>
                  {!loading && petFilteredServices.length > 0 ? (
                    <span className="hidden shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm sm:inline">
                      {petFilteredServices.length} available
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-white/85">Choose a service for your pet</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content sheet */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-t-[36px] bg-[#FAFAFA] shadow-[0_-8px_32px_rgba(0,0,0,0.08)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(209 213 219 / 0.35) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
          aria-hidden
        />

        <div className="relative flex-1 overflow-y-auto scrollbar-hide px-4 pb-8 pt-0">
          {topSlot ?? <AllServicesFeaturedBanner onNavigate={onNavigate} />}

          <div className="pt-4">
            <CategoryFilterChips selected={petFilter} onChange={setPetFilter} />
          </div>

          {loading ? (
            <div className="space-y-7 py-2">
              <div className="h-36 animate-pulse rounded-3xl bg-gray-200/70" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`sk-chip-${i}`} className="h-10 w-20 animate-pulse rounded-full bg-gray-200/70" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-large-${i}`}
                    className="h-[168px] animate-pulse rounded-3xl bg-gray-200/70"
                  />
                ))}
              </div>
              <div className="flex gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`sk-small-${i}`} className="flex flex-col items-center gap-2">
                    <div className="h-[4.25rem] w-[4.25rem] animate-pulse rounded-2xl bg-gray-200/70" />
                    <div className="h-3 w-14 animate-pulse rounded bg-gray-200/70" />
                  </div>
                ))}
              </div>
            </div>
          ) : showEmptyState ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-100 to-orange-50 shadow-inner">
                <PawPrint className="h-10 w-10 text-orange-300" />
              </div>
              <p className="text-base font-bold text-gray-800">No services for this pet type</p>
              <p className="mx-auto mt-2 max-w-[240px] text-sm text-gray-500">
                Try another filter or choose All to browse every service.
              </p>
              <button
                type="button"
                onClick={() => setPetFilter('all')}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FF8C42] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-200/50 active:scale-95"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Show all services
              </button>
            </div>
          ) : (
            <>
              {primaryServices.length > 0 ? (
                <section className="mb-8" aria-label="Services for You">
                  <SectionHeading title="Services for You" count={primaryServices.length} />
                  <div className="grid grid-cols-2 gap-3">
                    {primaryServices.map((service, index) => (
                      <ServiceCardLarge
                        key={service.screen || index}
                        service={service}
                        onPress={handleServicePress}
                        index={index}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {secondaryServices.length > 0 ? (
                <section className="mb-2" aria-label="More Services">
                  <SectionHeading
                    title="More Services"
                    count={secondaryServices.length}
                    accent="bg-gradient-to-b from-violet-400 to-purple-500"
                  />
                  <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide">
                    {secondaryServices.map((service, index) => (
                      <ServiceCardSmall
                        key={service.screen || index}
                        service={service}
                        onPress={handleServicePress}
                        index={index}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}

          <AllServicesTrustBar onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

/** All Services catalog — replaces ProblemGridSelector when new home UI flag is on. */
export const AllServicesScreen = memo(AllServicesScreenComponent);
