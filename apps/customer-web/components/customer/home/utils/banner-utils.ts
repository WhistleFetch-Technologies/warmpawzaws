import type { ComponentType } from 'react';
import { customerPathToScreen } from '@/lib/promotion-navigation';
import { isVendorBannerCta } from '@/lib/banner-cta-parse';
import { parseBannerInformationalFromMetadata } from '@/lib/banner-cta-target';
import { iconForCustomerHomeApiBanner, normalizeCustomerBannerTarget } from '@/lib/customer-banner-icons';
import { defaultBanners } from '../../homepage/constants';
import type { HomeCarouselBanner } from '../types';

function mapApiBannerRecord(
  b: Record<string, unknown>,
  defaults?: { gradientFrom?: string; gradientTo?: string }
): HomeCarouselBanner {
  const rawCta = String(b.ctaLink ?? b.cta_link ?? '').trim();
  const screenFromSlash =
    rawCta.startsWith('/') && !isVendorBannerCta(rawCta) ? customerPathToScreen(rawCta) : null;
  const ctaLink = screenFromSlash ?? rawCta;
  const explicitComingSoonFalse = b.comingSoon === false || b.coming_soon === false;
  const comingSoon = explicitComingSoonFalse ? false : Boolean(b.comingSoon || b.coming_soon);
  const isInformational = parseBannerInformationalFromMetadata(b.metadata);
  return {
    id: b.id as string | number,
    title: String(b.title ?? ''),
    subtitle: String(b.subtitle ?? ''),
    imageUrl: String(b.imageUrl || b.image_url || ''),
    gradientFrom: String(b.gradientFrom || b.gradient_from || defaults?.gradientFrom || '#FF8C42'),
    gradientTo: String(b.gradientTo || b.gradient_to || defaults?.gradientTo || '#FF6B35'),
    Icon: iconForCustomerHomeApiBanner(b) as ComponentType<{ className?: string }>,
    ctaText: String(b.ctaText || b.cta_text || 'Learn More'),
    ctaLink,
    navTarget: (b.navTarget as HomeCarouselBanner['navTarget']) ?? null,
    metadata: b.metadata ?? null,
    comingSoon,
    isInformational,
  };
}

/**
 * Build hero carousel slides from CMS home_top banners merged with static defaults.
 * Extracted from CustomerHomeComplete / useHomePageData — behavior preserved.
 */
export function buildHomeTopCarouselBanners(
  dynamicBanners: Record<string, unknown>[]
): HomeCarouselBanner[] {
  if (dynamicBanners.length === 0) {
    return defaultBanners as HomeCarouselBanner[];
  }

  const fromApi = dynamicBanners.map((b) => mapApiBannerRecord(b));

  const coveredTargets = new Set(
    fromApi.map((b) => normalizeCustomerBannerTarget(b.ctaLink)).filter(Boolean)
  );
  const coveredTitles = new Set(
    fromApi.map((b) => String(b.title || '').toLowerCase().trim()).filter(Boolean)
  );

  const defaultsNotInApi = (defaultBanners as HomeCarouselBanner[]).filter((d) => {
    const key = normalizeCustomerBannerTarget(d.ctaLink);
    if (key && coveredTargets.has(key)) return false;
    if (coveredTitles.has(String(d.title || '').toLowerCase().trim())) return false;
    return true;
  });

  return [...fromApi, ...defaultsNotInApi].slice(0, 20);
}
