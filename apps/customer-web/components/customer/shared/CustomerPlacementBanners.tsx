'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { navigateBannerCta, type BannerNavTarget } from '@/lib/banner-cta-navigation';
import { iconForCustomerHomeApiBanner } from '@/lib/customer-banner-icons';
import {
  isShopInformationalTarget,
  parseShopBannerTargetFromMetadata,
  resolveShopBannerProductPath,
  type ShopBannerTargetMetadata,
} from '@/lib/shop-banner-target';
import type { LucideIcon } from 'lucide-react';

type Placement = 'category' | 'checkout' | 'shop';

export type CustomerPlacementBannersProps = {
  placement: Placement;
  onNavigate?: (screen: string, data?: unknown) => void;
  className?: string;
  /** Extra classes on the banner shell (height, radius, etc.) */
  shellClassName?: string;
  /** Shown when CMS returns no active banners for this placement (after fetch completes). */
  fallback?: ReactNode;
};

type BannerVM = {
  id: string;
  title: string;
  subtitle?: string;
  gradientFrom: string;
  gradientTo: string;
  imageUrl?: string;
  ctaText: string;
  ctaLink?: string;
  navTarget?: BannerNavTarget | null;
  metadata?: unknown;
  shopBannerTarget?: ShopBannerTargetMetadata | null;
  Icon: LucideIcon;
};

function mapApiBanner(b: Record<string, unknown>, index: number): BannerVM {
  const meta = (b.metadata as Record<string, unknown> | undefined) || {};
  const imageUrlValue =
    b.imageUrl ??
    b.image_url ??
    b.bannerImageUrl ??
    b.banner_image_url ??
    b.backgroundImageUrl ??
    b.background_image_url ??
    meta.imageUrl ??
    meta.image_url ??
    meta.bannerImageUrl ??
    meta.banner_image_url;

  const ctaLink =
    b.ctaLink != null ? String(b.ctaLink) : b.cta_link != null ? String(b.cta_link) : undefined;

  return {
    id: String(b.id ?? `banner-${index}`),
    title: String(b.title ?? ''),
    subtitle: b.subtitle != null ? String(b.subtitle) : undefined,
    gradientFrom: String(b.gradientFrom ?? meta.gradient_from ?? '#FF8C42'),
    gradientTo: String(b.gradientTo ?? meta.gradient_to ?? '#FF6B35'),
    imageUrl: imageUrlValue != null ? String(imageUrlValue).trim() || undefined : undefined,
    ctaText: String(b.ctaText ?? b.cta_text ?? 'Learn More'),
    ctaLink,
    navTarget: (b.navTarget as BannerNavTarget | undefined) ?? null,
    metadata: b.metadata ?? null,
    shopBannerTarget: parseShopBannerTargetFromMetadata(b.metadata, ctaLink),
    Icon: iconForCustomerHomeApiBanner(b),
  };
}

const CLICK_SOURCE: Record<Placement, string> = {
  category: 'category_all_services',
  checkout: 'checkout',
  shop: 'shop_main',
};

const RETURN_SCREEN: Record<Placement, string | undefined> = {
  category: 'problem_grid',
  checkout: undefined,
  shop: undefined,
};

function scrollToShopSection(ctaLink: string): boolean {
  const raw = ctaLink.trim();
  if (!raw.startsWith('#')) return false;
  const id = raw.slice(1).trim();
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function isShopBannerNonClickable(banner: BannerVM): boolean {
  if (isShopInformationalTarget(banner.shopBannerTarget)) {
    return true;
  }
  return false;
}

/** Fetches and renders CMS banners for category, checkout, or shop main page. */
export function CustomerPlacementBanners({
  placement,
  onNavigate,
  className = '',
  shellClassName = '',
  fallback = null,
}: CustomerPlacementBannersProps) {
  const router = useRouter();
  const [banners, setBanners] = useState<BannerVM[]>([]);
  const [fetched, setFetched] = useState(false);
  const [ix, setIx] = useState(0);
  const count = banners.length;
  const isCheckout = placement === 'checkout';

  const handleBannerClick = useCallback(
    async (banner: BannerVM) => {
      if (isCheckout) return;
      if (placement === 'shop') {
        if (isShopBannerNonClickable(banner)) return;
        const productPath = resolveShopBannerProductPath(banner.shopBannerTarget, banner.ctaLink);
        if (productPath) {
          router.push(productPath);
          return;
        }
        if (banner.ctaLink && scrollToShopSection(banner.ctaLink)) {
          return;
        }
        return;
      }
      if (!banner.ctaLink && !banner.navTarget && !banner.metadata) return;
      await navigateBannerCta(
        {
          ctaLink: banner.ctaLink,
          title: banner.title,
          subtitle: banner.subtitle,
          metadata: banner.metadata,
          navTarget: banner.navTarget,
          returnScreen: RETURN_SCREEN[placement],
        },
        onNavigate as ((dest: string, data?: Record<string, unknown>) => void) | undefined,
        router
      );
    },
    [isCheckout, onNavigate, placement, router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ banners?: unknown[] }>(`/customer/banners?position=${placement}&limit=20`);
        const raw = (res?.banners as Record<string, unknown>[]) || [];
        const vms = raw.map((row, i) => mapApiBanner(row, i));
        if (!cancelled) {
          setBanners(vms);
          setIx(0);
        }
      } catch {
        if (!cancelled) {
          setBanners([]);
        }
      } finally {
        if (!cancelled) {
          setFetched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  useEffect(() => {
    if (count > 0) setIx((prev) => prev % count);
  }, [count]);

  if (!fetched) return null;
  if (count === 0) return <>{fallback}</>;

  const source = CLICK_SOURCE[placement];

  return (
    <div className={className}>
      <div
        className={`relative h-[152px] overflow-hidden rounded-2xl text-white shadow-md ${shellClassName}`}
      >
        {banners.map((banner, index) => {
          const displayOnly =
            isCheckout || (placement === 'shop' && isShopBannerNonClickable(banner));

          return (
          <div
            key={banner.id}
            aria-hidden={index !== ix}
            className={`absolute inset-0 transition-opacity duration-300 ${
              index === ix
                ? 'pointer-events-auto z-10 opacity-100'
                : 'pointer-events-none z-0 opacity-0'
            }`}
            style={{
              backgroundImage: banner.imageUrl
                ? `linear-gradient(90deg, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.35) 45%, rgba(0, 0, 0, 0.15) 100%), url("${banner.imageUrl}")`
                : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="flex h-full items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-bold leading-tight">{banner.title}</h3>
                {banner.subtitle ? (
                  <p className="mt-1 line-clamp-2 text-xs text-white/90">{banner.subtitle}</p>
                ) : null}
                {displayOnly ? (
                  <p className="mt-3 inline-block text-xs font-medium text-white/90">{banner.ctaText}</p>
                ) : (
                  <button
                    type="button"
                    className="mt-3 inline-block rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#FF8C42]"
                    onClick={() => {
                      if (banner.id) {
                        apiClient.post(`/banners/${banner.id}/click`, { source }).catch(() => {});
                      }
                      void handleBannerClick(banner);
                    }}
                  >
                    {banner.ctaText}
                  </button>
                )}
              </div>
              {banner.imageUrl ? null : (
                <banner.Icon className="h-8 w-8 shrink-0 text-white/95" aria-hidden />
              )}
            </div>
          </div>
          );
        })}
        {count > 1 ? (
          <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`h-1.5 rounded-full transition-all ${
                  i === ix ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                }`}
                aria-label={`Promotion ${i + 1} of ${count}`}
                onClick={() => setIx(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
