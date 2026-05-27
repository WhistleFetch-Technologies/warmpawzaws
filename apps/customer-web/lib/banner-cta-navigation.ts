import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

import { customerPathToScreen } from '@/lib/promotion-navigation';

import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';

import { isVendorBannerCta, parseBannerCtaLink } from '@/lib/banner-cta-parse';

import { withBannerNavigationOrigin } from '@/lib/banner-navigation-origin';

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



function hasBannerTargetMetadata(metadata: unknown): boolean {

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;

  const meta = metadata as Record<string, unknown>;

  const bt = meta.bannerTarget ?? meta.banner_target;

  return bt != null && typeof bt === 'object' && !Array.isArray(bt);

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
    if (isVendorBannerCta(path)) {
      return false;
    }
    router.push(path.startsWith('/') ? path : `/${path}`);
    return true;
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



  const ctaLink = String(banner.ctaLink ?? '').trim();

  const title = String(banner.title ?? '').trim();

  const hasTarget = hasBannerTargetMetadata(banner.metadata);

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
  const dest = String(banner.ctaLink ?? '').trim();
  const returnScreen = banner.returnScreen;

  if (banner.navTarget && applyBannerNavTarget(banner.navTarget, onNavigate, router, returnScreen)) {
    return true;
  }

  if (hasBannerTargetMetadata(banner.metadata) || parseBannerCtaLink(dest)) {
    const resolved = await resolveBannerNavTarget(banner);
    if (resolved && applyBannerNavTarget(resolved, onNavigate, router, returnScreen)) {
      return true;
    }
    if (hasBannerTargetMetadata(banner.metadata) || parseBannerCtaLink(dest)) {
      showBannerNavigationUnavailable();
      return false;
    }
  }



  if (!dest) return false;



  if (/^https?:\/\//i.test(dest) || dest.startsWith('//')) {

    window.location.assign(dest.startsWith('//') ? `https:${dest}` : dest);

    return true;

  }

  if (/^(mailto:|tel:)/i.test(dest)) {

    window.location.href = dest;

    return true;

  }

  if (dest.startsWith('/')) {

    if (isVendorBannerCta(dest)) {

      showBannerNavigationUnavailable();

      return false;

    }

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

        persona: parseBannerCtaLink(ctaLink)?.persona,

        vendorId: input.vendorId,

        vendorServiceId: input.vendorServiceId ?? null,

        serviceStyle: input.serviceStyle,

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


