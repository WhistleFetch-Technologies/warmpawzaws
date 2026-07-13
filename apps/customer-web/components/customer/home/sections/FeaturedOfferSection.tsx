'use client';

import React, { memo } from 'react';
import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { clickHomeBannerCta } from '@/lib/banner-cta-navigation';
import { isBannerInformationalNonClickable } from '@/lib/banner-cta-target';
import { buildBannerBackgroundStyle } from '@/lib/customer-banner-surface';
import type { BannerNavTarget } from '@/lib/banner-cta-navigation';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface FeaturedLowerBanner {
  id?: string | number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  Icon: ComponentType<{ className?: string }>;
  ctaText: string;
  ctaLink: string;
  comingSoon?: boolean;
  isInformational?: boolean;
  metadata?: unknown;
  navTarget?: BannerNavTarget | null;
}

export interface FeaturedOfferSectionProps {
  lowerBanners: FeaturedLowerBanner[];
  onNavigate: HomeNavigateFn;
  className?: string;
}

function FeaturedOfferSectionComponent({
  lowerBanners,
  onNavigate,
  className = '',
}: FeaturedOfferSectionProps) {
  const router = useRouter();
  const hasLower = lowerBanners.length > 0;

  if (!hasLower) return null;

  return (
    <div className={className}>
      <div className="mb-6 space-y-4 px-4">
        {lowerBanners.map((banner, index) => {
          const slotComingSoon = Boolean(banner.comingSoon);
          const slotNonClickable = slotComingSoon || isBannerInformationalNonClickable(banner);
          return (
            <div
              key={String(banner.id ?? index)}
              className="relative overflow-hidden rounded-3xl p-6 text-white"
              style={buildBannerBackgroundStyle({
                imageUrl: banner.imageUrl,
                gradientFrom: banner.gradientFrom,
                gradientTo: banner.gradientTo,
              })}
            >
              <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="mb-2 line-clamp-2 text-lg font-bold">{banner.title}</h2>
                  {banner.subtitle ? (
                    <p className="mb-4 line-clamp-3 text-sm text-white/90">{banner.subtitle}</p>
                  ) : null}
                  {slotNonClickable ? (
                    <span className="inline-block cursor-not-allowed rounded-full bg-white/85 px-5 py-2.5 text-sm font-medium text-[#FF8C42]/70">
                      {banner.ctaText || 'Learn More'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void clickHomeBannerCta(banner, onNavigate, router, {
                          trackingSource: 'home_lower_featured',
                          returnScreen: 'home',
                        });
                      }}
                      className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-indigo-600"
                    >
                      {banner.ctaText || 'Learn More'}
                    </button>
                  )}
                </div>
                <banner.Icon className="h-14 w-14 shrink-0 text-white/80" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** CMS home_lower banners only. */
export const FeaturedOfferSection = memo(FeaturedOfferSectionComponent);
