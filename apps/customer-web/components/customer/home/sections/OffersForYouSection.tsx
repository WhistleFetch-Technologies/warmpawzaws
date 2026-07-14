'use client';

import React, { memo, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clickHomeBannerCta } from '@/lib/banner-cta-navigation';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  DEFAULT_FEATURED_OFFER,
  DEFAULT_FEATURED_OFFER_IMAGE_URL,
} from '../constants/featured-offer-fallback';
import {
  buildBannerBackgroundStyle,
  buildBannerGradientOverlayBackground,
} from '@/lib/customer-banner-surface';
import type { FeaturedLowerBanner } from './FeaturedOfferSection';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

interface ResolvedOffer {
  id?: string | number;
  title: string;
  subtitle?: string;
  pillLabel: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  comingSoon?: boolean;
  onCtaClick?: () => void;
}

function OfferThumbnail({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={120}
        height={120}
        className="h-[7.5rem] w-[7.5rem] object-contain"
        unoptimized
      />
    );
  }
  return (
    <PresignableImage
      src={src}
      alt={alt}
      className="h-[7.5rem] w-[7.5rem] object-contain"
    />
  );
}

function CmsBannerImage({ src, alt }: { src: string; alt: string }) {
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

export interface OffersForYouSectionProps {
  lowerBanners: FeaturedLowerBanner[];
  onNavigate: HomeNavigateFn;
  className?: string;
}

function OffersForYouSectionComponent({
  lowerBanners,
  onNavigate,
  className = '',
}: OffersForYouSectionProps) {
  const router = useRouter();

  const offer: ResolvedOffer = useMemo(() => {
    const banner = lowerBanners[0];
    if (banner) {
      return {
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        pillLabel: 'Featured',
        ctaText: banner.ctaText || 'Learn More',
        ctaLink: banner.ctaLink,
        imageUrl: banner.imageUrl || DEFAULT_FEATURED_OFFER_IMAGE_URL,
        comingSoon: banner.comingSoon,
        onCtaClick: () => {
          if (banner.comingSoon) return;
          void clickHomeBannerCta(banner, onNavigate, router, {
            trackingSource: 'home_lower_featured',
            returnScreen: 'home',
          });
        },
      };
    }

    return {
      title: DEFAULT_FEATURED_OFFER.title,
      subtitle: DEFAULT_FEATURED_OFFER.subtitle,
      pillLabel: DEFAULT_FEATURED_OFFER.pillLabel,
      ctaText: DEFAULT_FEATURED_OFFER.ctaText,
      ctaLink: DEFAULT_FEATURED_OFFER.ctaLink,
      imageUrl: DEFAULT_FEATURED_OFFER.imageUrl,
      onCtaClick: () => onNavigate(DEFAULT_FEATURED_OFFER.ctaLink),
    };
  }, [lowerBanners, onNavigate, router]);

  const cmsBanner = lowerBanners[0];
  const isCmsBanner = Boolean(cmsBanner);
  const isCmsBannerWithImage = Boolean(cmsBanner?.imageUrl?.trim());

  if (isCmsBannerWithImage && cmsBanner) {
    return (
      <div className={`mb-6 px-4 ${className}`}>
        <div className="relative min-h-[11rem] overflow-hidden rounded-3xl">
          <CmsBannerImage src={offer.imageUrl} alt={offer.title} />
          <div
            className="absolute inset-0"
            style={{
              background: buildBannerGradientOverlayBackground({
                gradientFrom: cmsBanner.gradientFrom,
                gradientTo: cmsBanner.gradientTo,
              }),
            }}
          />
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative z-10 flex min-h-[11rem] flex-col justify-center p-6 text-white">
            <span className="mb-2 inline-block w-fit rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
              {offer.pillLabel}
            </span>
            <h2 className="mb-1 line-clamp-2 text-lg font-bold">{offer.title}</h2>
            {offer.subtitle ? (
              <p className="mb-4 line-clamp-2 text-sm text-white/90">{offer.subtitle}</p>
            ) : null}
            {offer.comingSoon ? (
              <span className="inline-block w-fit cursor-not-allowed rounded-full bg-white/85 px-5 py-2.5 text-sm font-medium text-[#FF8C42]/70">
                {offer.ctaText}
              </span>
            ) : (
              <button
                type="button"
                onClick={offer.onCtaClick}
                className="w-fit rounded-full bg-white px-5 py-2.5 text-sm font-medium text-indigo-600"
              >
                {offer.ctaText}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isCmsBanner && cmsBanner) {
    return (
      <div className={`mb-6 px-4 ${className}`}>
        <div
          className="relative min-h-[11rem] overflow-hidden rounded-3xl text-white"
          style={buildBannerBackgroundStyle({
            gradientFrom: cmsBanner.gradientFrom,
            gradientTo: cmsBanner.gradientTo,
          })}
        >
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative z-10 flex min-h-[11rem] flex-col justify-center p-6">
            <span className="mb-2 inline-block w-fit rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
              {offer.pillLabel}
            </span>
            <h2 className="mb-1 line-clamp-2 text-lg font-bold">{offer.title}</h2>
            {offer.subtitle ? (
              <p className="mb-4 line-clamp-2 text-sm text-white/90">{offer.subtitle}</p>
            ) : null}
            {offer.comingSoon ? (
              <span className="inline-block w-fit cursor-not-allowed rounded-full bg-white/85 px-5 py-2.5 text-sm font-medium text-[#FF8C42]/70">
                {offer.ctaText}
              </span>
            ) : (
              <button
                type="button"
                onClick={offer.onCtaClick}
                className="w-fit rounded-full bg-white px-5 py-2.5 text-sm font-medium text-indigo-600"
              >
                {offer.ctaText}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-6 px-4 ${className}`}>
      <div className="relative overflow-hidden rounded-3xl bg-[#FFF0E6] px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <span className="mb-2 inline-block rounded-full bg-[#FF8C42]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#FF8C42]">
              {offer.pillLabel}
            </span>
            <h2 className="mb-1 line-clamp-2 text-base font-bold text-gray-900">{offer.title}</h2>
            {offer.subtitle ? (
              <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-gray-600">
                {offer.subtitle}
              </p>
            ) : null}
            {offer.comingSoon ? (
              <span className="inline-block cursor-not-allowed rounded-full border-2 border-[#FF8C42]/40 px-5 py-2 text-sm font-medium text-[#FF8C42]/60">
                {offer.ctaText}
              </span>
            ) : (
              <button
                type="button"
                onClick={offer.onCtaClick}
                className="rounded-full border-2 border-[#FF8C42] bg-transparent px-5 py-2 text-sm font-semibold text-[#FF8C42] transition-colors hover:bg-[#FF8C42]/10"
              >
                {offer.ctaText}
              </button>
            )}
          </div>
          <div className="shrink-0">
            <OfferThumbnail src={offer.imageUrl} alt={offer.title} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Peach featured banner — CMS lower banner or static fallback. */
export const OffersForYouSection = memo(OffersForYouSectionComponent);
