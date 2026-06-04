import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

import { customerPathToScreen } from '@/lib/promotion-navigation';

import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';

import { isVendorBannerCta, parseBannerCtaLink } from '@/lib/banner-cta-parse';

import { withBannerNavigationOrigin } from '@/lib/banner-navigation-origin';

import {
  buildArticleBannerPath,
  isInAppCategoryBannerTargetMetadata,
  parseArticleSlugFromBannerPath,
  parseArticleSlugFromCtaLink,
  parseBannerArticleSlugFromMetadata,
  parseBannerInformationalFromMetadata,
} from '@/lib/banner-cta-target';

export type BannerNavTarget =
  | { kind: 'screen'; screen: string; data?: Record<string, unknown> }
  | { kind: 'path'; path: string };

export type BannerNavInput = {
  ctaLink?: unknown;
  title?: unknown;
  subtitle?: unknown;
  metadata?: unknown;
  navTarget?: BannerNavTarget | null;
  /** Customer screen to return to when user taps Back after banner navigation */
  returnScreen?: string;
};

export type InitialBannerNavigation = {
  screen: string;
  data?: Record<string, unknown>;
};

type NavigateFn = (dest: string, data?: Record<string, unknown>) => void;

export function resolveBannerArticlePath(banner: BannerNavInput): string | null {
  if (banner.navTarget?.kind === 'path') {
    const path = String(banner.navTarget.path ?? '').trim();
    if (parseArticleSlugFromBannerPath(path)) return path;
  }

  const slugFromMeta = parseBannerArticleSlugFromMetadata(banner.metadata);
  if (slugFromMeta) return buildArticleBannerPath(slugFromMeta);

  const slugFromCta = parseArticleSlugFromCtaLink(banner.ctaLink);
  if (slugFromCta) return buildArticleBannerPath(slugFromCta);

  return null;
}

export function navigateBannerLink(
  url: string,
  onNavigate: NavigateFn | undefined,
  router: AppRouterInstance,
  returnScreen?: string
): boolean {
  const dest = String(url ?? '').trim();
  if (!dest) return false;

  const articlePath = parseArticleSlugFromBannerPath(dest);
  if (articlePath) {
    router.push(articlePath);
    return true;
  }

  if (/^(mailto:|tel:)/i.test(dest)) {
    if (typeof window !== 'undefined') window.location.href = dest;
    return true;
  }

  if (dest.startsWith('/')) {
    if (isVendorBannerCta(dest)) return false;
    const screenFromPath = customerPathToScreen(dest);
    if (screenFromPath) {
      onNavigate?.(screenFromPath, withBannerNavigationOrigin({}, returnScreen));
      return true;
    }
    router.push(dest);
    return true;
  }

  onNavigate?.(dest);
  return true;
}

export function applyBannerNavTarget(
  navTarget: BannerNavTarget,
  onNavigate: NavigateFn | undefined,
  router: AppRouterInstance,
  returnScreen?: string
): boolean {
  if (navTarget.kind === 'path') {
    const path = String(navTarget.path || '').trim();
    if (!path) return false;
    return navigateBannerLink(path, onNavigate, router, returnScreen);
  }

  const screen = String(navTarget.screen || '').trim();
  if (!screen) return false;

  const data = withBannerNavigationOrigin(navTarget.data ?? {}, returnScreen);

  if (screen === 'vet-booking' && data.teleInstantPay && data.serviceId) {
    const url = buildTeleInstantAutoPayBookingUrl({
      serviceId: String(data.serviceId),
      vendorId: data.vendorId ? String(data.vendorId) : undefined,
    });
    if (url) {
      router.push(url);
      return true;
    }
  }

  if (onNavigate) {
    onNavigate(screen, data);
    return true;
  }

  return false;
}

/** Map resolved nav target to CustomerHomeWrapper initial navigation props. */
export function navTargetToInitialBannerNavigation(
  navTarget: BannerNavTarget | null | undefined,
  returnScreen?: string
): InitialBannerNavigation | null {
  if (!navTarget || navTarget.kind !== 'screen') return null;
  const screen = String(navTarget.screen || '').trim();
  if (!screen) return null;
  return {
    screen,
    data: withBannerNavigationOrigin(navTarget.data ?? {}, returnScreen),
  };
}

export async function resolveBannerNavTarget(banner: BannerNavInput): Promise<BannerNavTarget | null> {
  if (banner.navTarget) {
    return banner.navTarget;
  }

  const articlePath = resolveBannerArticlePath(banner);
  if (articlePath) {
    return { kind: 'path', path: articlePath };
  }

  const ctaLink = String(banner.ctaLink ?? '').trim();
  const title = String(banner.title ?? '').trim();
  const hasTarget = isInAppCategoryBannerTargetMetadata(banner.metadata);

  if (!hasTarget && (!ctaLink || !parseBannerCtaLink(ctaLink))) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    if (ctaLink) params.set('ctaLink', ctaLink);
    if (title) params.set('title', title);
    const subtitle = String(banner.subtitle ?? '').trim();
    if (subtitle) params.set('subtitle', subtitle);
    if (banner.metadata) {
      params.set('metadata', JSON.stringify(banner.metadata));
    }

    const res = await apiClient.get<{ navTarget?: BannerNavTarget }>(
      `/customer/banners/resolve-cta?${params.toString()}`
    );
    return res?.navTarget ?? null;
  } catch {
    return null;
  }
}

function showBannerNavigationUnavailable(): void {
  toast.error('This offer is unavailable right now', {
    description: 'The clinic or service may have been updated. Try again from the home page.',
  });
}

/** Navigate from a CMS banner CTA — uses pre-resolved navTarget or resolves on demand. */
export async function navigateBannerCta(
  banner: BannerNavInput,
  onNavigate: NavigateFn | undefined,
  router: AppRouterInstance
): Promise<boolean> {
  if (parseBannerInformationalFromMetadata(banner.metadata)) {
    return false;
  }

  const dest = String(banner.ctaLink ?? '').trim();
  const returnScreen = banner.returnScreen;

  const articlePath = resolveBannerArticlePath(banner);
  if (articlePath && navigateBannerLink(articlePath, onNavigate, router, returnScreen)) {
    return true;
  }

  if (banner.navTarget && applyBannerNavTarget(banner.navTarget, onNavigate, router, returnScreen)) {
    return true;
  }

  if (isInAppCategoryBannerTargetMetadata(banner.metadata) || parseBannerCtaLink(dest)) {
    const resolved = await resolveBannerNavTarget(banner);
    if (resolved && applyBannerNavTarget(resolved, onNavigate, router, returnScreen)) {
      return true;
    }
    if (isInAppCategoryBannerTargetMetadata(banner.metadata) || parseBannerCtaLink(dest)) {
      showBannerNavigationUnavailable();
      return false;
    }
  }

  if (!dest) return false;

  return navigateBannerLink(dest, onNavigate, router, returnScreen);
}

/** Deep link page: resolve CTA path (+ optional query metadata) → initial home-wrapper navigation. */
export async function resolveBannerDeepLinkNavigation(input: {
  ctaLink: string;
  title?: string;
  subtitle?: string;
  metadata?: unknown;
  vendorId?: string;
  vendorServiceId?: string;
  serviceStyle?: string;
}): Promise<InitialBannerNavigation | null> {
  const ctaLink = String(input.ctaLink ?? '').trim();
  if (!ctaLink) return null;

  let metadata = input.metadata;
  if (!metadata && (input.vendorId || input.vendorServiceId || input.serviceStyle)) {
    metadata = {
      bannerTarget: {
        persona: 'vet',
        vendorId: input.vendorId,
        vendorServiceId: input.vendorServiceId ?? null,
        serviceStyle: input.serviceStyle,
        targetLevel: 'vendor',
      },
    };
  }

  const navTarget = await resolveBannerNavTarget({
    ctaLink,
    title: input.title,
    subtitle: input.subtitle,
    metadata,
  });

  return navTargetToInitialBannerNavigation(navTarget);
}
