'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { isBannerInformationalNonClickable } from '@/lib/banner-cta-target';
import { PresignableImage } from '@/components/shared/PresignableImage';
import type { FeaturedLowerBanner } from './FeaturedOfferSection';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

function LowerBannerBackground({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        unoptimized
      />
    );
  }
  return (
    <PresignableImage
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  );
}

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
        const slotNonClickable = slotComingSoon || isBannerInformationalNonClickable(banner);
        const hasImage = Boolean(banner.imageUrl?.trim());
        return (
          <div
            key={String(banner.id ?? index)}
            className="relative min-h-[11rem] overflow-hidden rounded-3xl text-white"
            style={
              hasImage
                ? undefined
                : {
                    background: `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
                  }
            }
          >
            {hasImage ? (
              <>
                <LowerBannerBackground src={banner.imageUrl} alt={banner.title} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
              </>
            ) : null}
            <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative z-10 flex min-h-[11rem] items-start justify-between gap-4 p-6 pr-20 sm:pr-6">
              <div className="min-w-0 flex-1">
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
