'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { DEFAULT_HOME_HERO_IMAGE_URL } from '../constants/category-card-images';
import { resolveBannerObjectPosition } from '../constants/banner-image-position';
import { useBannerCarousel } from '../hooks/useBannerCarousel';
import { buildBannerGradientOverlayBackground } from '@/lib/customer-banner-surface';
import type { HomeCarouselBanner } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface BannerCarouselProps {
  banners: HomeCarouselBanner[];
  onNavigate: HomeNavigateFn;
  /** Analytics source tag for click tracking */
  trackingSource?: string;
  className?: string;
  heightClassName?: string;
}

function resolveBannerImageUrl(banner: HomeCarouselBanner): string {
  const cms = String(banner.imageUrl || '').trim();
  if (cms) return cms;
  const id = String(banner.id ?? '');
  if (id.startsWith('default-')) return DEFAULT_HOME_HERO_IMAGE_URL;
  return '';
}

function BannerHeroImage({
  src,
  alt,
  objectPosition,
}: {
  src: string;
  alt: string;
  objectPosition: string;
}) {
  const imageStyle = { objectPosition };

  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        style={imageStyle}
        unoptimized
      />
    );
  }
  if (src.includes('amazonaws.com')) {
    return (
      <PresignableImage
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={imageStyle}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      style={imageStyle}
    />
  );
}

function BannerCarouselComponent({
  banners,
  onNavigate,
  trackingSource = 'home_carousel',
  className = '',
  heightClassName = 'h-[8.8rem]',
}: BannerCarouselProps) {
  const { currentIndex, setCurrentIndex, touchHandlers } = useBannerCarousel(banners.length);

  if (banners.length === 0) return null;

  return (
    <div className={`mb-4 px-4 ${className}`}>
      <div
        className={`relative ${heightClassName} overflow-hidden rounded-2xl shadow-md`}
        {...touchHandlers}
      >
        {banners.map((banner, index) => {
          const heroComingSoon = Boolean(banner.comingSoon);
          const heroNonClickable = heroComingSoon || Boolean(banner.isInformational);
          const imageUrl = resolveBannerImageUrl(banner);
          const hasHeroImage = Boolean(imageUrl);

          return (
            <div
              key={String(banner.id ?? index)}
              className={`absolute inset-0 transition-opacity duration-500 ${
                currentIndex === index
                  ? 'z-[1] opacity-100'
                  : 'pointer-events-none z-0 opacity-0'
              }`}
              style={
                hasHeroImage
                  ? undefined
                  : {
                      background: `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
                    }
              }
              aria-hidden={currentIndex !== index}
            >
              {hasHeroImage ? (
                <>
                  <BannerHeroImage
                    src={imageUrl}
                    alt={banner.title}
                    objectPosition={resolveBannerObjectPosition(banner)}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: buildBannerGradientOverlayBackground({
                        gradientFrom: banner.gradientFrom,
                        gradientTo: banner.gradientTo,
                      }),
                    }}
                  />
                </>
              ) : null}

              {heroComingSoon && (
                <span
                  className="absolute right-3 top-2 z-[2] rounded-full bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm"
                  aria-label="Coming soon"
                >
                  SOON
                </span>
              )}
              <div
                className={`relative z-[1] flex h-full items-center justify-between px-4 ${
                  heroNonClickable ? 'pointer-events-none select-none opacity-90' : ''
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="mb-0.5 truncate text-base font-bold text-white">{banner.title}</h2>
                  <p className="mb-2 line-clamp-2 text-xs text-white/90">{banner.subtitle}</p>
                  {heroNonClickable ? (
                    <span
                      role="button"
                      aria-disabled
                      tabIndex={-1}
                      className="inline-block cursor-not-allowed rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-[#FF8C42]/70"
                    >
                      {banner.ctaText || 'Claim Now'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#FF8C42]"
                      onClick={() => {
                        if (banner.id) {
                          apiClient
                            .post(`/banners/${banner.id}/click`, { source: trackingSource })
                            .catch(() => {});
                        }
                        if (banner.ctaLink) onNavigate(String(banner.ctaLink));
                      }}
                    >
                      {banner.ctaText || 'Claim Now'}
                    </button>
                  )}
                </div>
                {!hasHeroImage ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <banner.Icon className="h-7 w-7 text-white" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {banners.length > 1 ? (
          <div
            className="absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-2"
            role="tablist"
            aria-label="Promotional offers"
          >
            {banners.map((banner, index) => (
              <button
                key={String(banner.id ?? index)}
                type="button"
                role="tab"
                aria-selected={currentIndex === index}
                aria-label={`Offer ${index + 1} of ${banners.length}`}
                className={`h-1.5 min-w-[6px] rounded-full transition-all ${
                  currentIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Hero / promo banner carousel with swipe, auto-scroll, and CTA navigation. */
export const BannerCarousel = memo(BannerCarouselComponent);
