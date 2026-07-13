'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { clickHomeBannerCta } from '@/lib/banner-cta-navigation';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { resolvePromotionDestination } from '@/lib/promotion-navigation';
import { parsePromotionApplicableServices } from '@/lib/promotion-banner-filter';
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

interface SpotlightPromotion {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  service_category?: string;
  service_style?: string;
  applicable_services?: string[] | unknown;
  metadata?: Record<string, unknown>;
}

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
  const [spotlight, setSpotlight] = useState<SpotlightPromotion | null>(null);
  const [spotlightLoaded, setSpotlightLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSpotlight = async () => {
      try {
        const params = new URLSearchParams({
          service: 'all',
          published: 'true',
          spotlight: 'true',
        });
        const response = await apiClient.get<{ promotions?: SpotlightPromotion[]; success?: boolean }>(
          `/promotions/list?${params.toString()}`
        );
        if (cancelled) return;
        const promos = response?.promotions;
        if (Array.isArray(promos) && promos.length > 0) {
          setSpotlight(promos[0]);
        }
      } catch {
        /* graceful fallback */
      } finally {
        if (!cancelled) setSpotlightLoaded(true);
      }
    };

    if (lowerBanners.length === 0) {
      void loadSpotlight();
    } else {
      setSpotlightLoaded(true);
    }

    return () => {
      cancelled = true;
    };
  }, [lowerBanners.length]);

  const navigateSpotlight = useCallback(
    (promo: SpotlightPromotion) => {
      apiClient.post(`/promotions/${promo.id}/click`, { source: 'home_featured_offer' }).catch(() => {});
      const parsedApplicable = parsePromotionApplicableServices(promo.applicable_services);
      const styleToken = parsedApplicable.find((x) => x.startsWith('style:'));
      const categoryToken = parsedApplicable.find((x) => !x.startsWith('style:') && x.trim() !== '');
      const resolvedStyle = String(
        promo.service_style ??
          (styleToken ? styleToken.replace(/^style:/, '') : '') ??
          (promo.metadata as { serviceStyle?: string })?.serviceStyle ??
          ''
      )
        .trim()
        .toLowerCase();
      const resolvedCategory = String(
        promo.service_category ??
          categoryToken ??
          (promo.metadata as { serviceCategory?: string })?.serviceCategory ??
          ''
      )
        .trim()
        .toLowerCase();
      let screen = resolvePromotionDestination(
        {
          ...(promo as unknown as Record<string, unknown>),
          service_category: resolvedCategory,
          service_style: resolvedStyle,
        },
        'all'
      );
      if (screen === 'home') screen = 'services';
      onNavigate(screen, {
        promotionId: promo.id,
        ...(resolvedStyle ? { serviceStyle: resolvedStyle } : {}),
      });
    },
    [onNavigate]
  );

  const offer: ResolvedOffer | null = useMemo(() => {
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

    if (!spotlightLoaded) return null;

    if (spotlight) {
      const metaImage =
        (spotlight.metadata as { imageUrl?: string; image?: string })?.imageUrl ||
        (spotlight.metadata as { image?: string })?.image;
      return {
        id: spotlight.id,
        title: spotlight.name,
        subtitle: spotlight.description,
        pillLabel: 'Featured',
        ctaText: 'Learn More',
        ctaLink: '',
        imageUrl: spotlight.imageUrl || metaImage || DEFAULT_FEATURED_OFFER_IMAGE_URL,
        onCtaClick: () => navigateSpotlight(spotlight),
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
  }, [lowerBanners, spotlight, spotlightLoaded, navigateSpotlight, onNavigate, router]);

  if (!offer) return null;

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

/** Peach featured banner — CMS lower banner, spotlight promo, or static fallback. */
export const OffersForYouSection = memo(OffersForYouSectionComponent);
