'use client';

import React, { memo } from 'react';
import { apiClient } from '@/lib/api-client';
import type { FeaturedLowerBanner } from './FeaturedOfferSection';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface HomeLowerBannersSectionProps {
  lowerBanners: FeaturedLowerBanner[];
  onNavigate: HomeNavigateFn;
  className?: string;
}

function HomeLowerBannersSectionComponent({
  lowerBanners,
  onNavigate,
  className = '',
}: HomeLowerBannersSectionProps) {
  if (lowerBanners.length === 0) return null;

  return (
    <div className={`mb-6 space-y-4 px-4 ${className}`}>
      {lowerBanners.map((banner, index) => {
        const slotComingSoon = Boolean(banner.comingSoon);
        return (
          <div
            key={String(banner.id ?? index)}
            className="relative overflow-hidden rounded-3xl p-6 text-white"
            style={{
              backgroundImage: banner.imageUrl
                ? `linear-gradient(135deg, rgba(17,24,39,0.75) 0%, rgba(17,24,39,0.45) 100%), url(${banner.imageUrl})`
                : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="mb-2 line-clamp-2 text-lg font-bold">{banner.title}</h2>
                {banner.subtitle ? (
                  <p className="mb-4 line-clamp-3 text-sm text-white/90">{banner.subtitle}</p>
                ) : null}
                {slotComingSoon ? (
                  <span className="inline-block cursor-not-allowed rounded-full bg-white/85 px-5 py-2.5 text-sm font-medium text-[#FF8C42]/70">
                    {banner.ctaText || 'Learn More'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (banner.id) {
                        apiClient
                          .post(`/banners/${banner.id}/click`, { source: 'home_lower_featured' })
                          .catch(() => {});
                      }
                      banner.ctaLink && onNavigate(String(banner.ctaLink));
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
  );
}

export const HomeLowerBannersSection = memo(HomeLowerBannersSectionComponent);
