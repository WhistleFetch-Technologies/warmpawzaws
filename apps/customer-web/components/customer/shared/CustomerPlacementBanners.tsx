'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { navigateBannerCta, type BannerNavTarget } from '@/lib/banner-cta-navigation';
import { iconForCustomerHomeApiBanner } from '@/lib/customer-banner-icons';
import type { LucideIcon } from 'lucide-react';

type Placement = 'category' | 'checkout';

export type CustomerPlacementBannersProps = {
  placement: Placement;
  onNavigate?: (screen: string, data?: unknown) => void;
  className?: string;
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

  return {
    id: String(b.id ?? `banner-${index}`),
    title: String(b.title ?? ''),
    subtitle: b.subtitle != null ? String(b.subtitle) : undefined,
    gradientFrom: String(b.gradientFrom ?? meta.gradient_from ?? '#FF8C42'),
    gradientTo: String(b.gradientTo ?? meta.gradient_to ?? '#FF6B35'),
    imageUrl: imageUrlValue != null ? String(imageUrlValue).trim() || undefined : undefined,
    ctaText: String(b.ctaText ?? b.cta_text ?? 'Learn More'),
    ctaLink: b.ctaLink != null ? String(b.ctaLink) : b.cta_link != null ? String(b.cta_link) : undefined,
    navTarget: (b.navTarget as BannerNavTarget | undefined) ?? null,
    metadata: b.metadata ?? null,
    Icon: iconForCustomerHomeApiBanner(b),
  };
}

const CLICK_SOURCE: Record<Placement, string> = {
  category: 'category_all_services',
  checkout: 'checkout',
};

const RETURN_SCREEN: Record<Placement, string | undefined> = {
  category: 'problem_grid',
  checkout: undefined,
};

/** Fetches and renders CMS banners for category (All Services) or checkout. Home hero/middle are only on the home page. */
export function CustomerPlacementBanners({ placement, onNavigate, className = '' }: CustomerPlacementBannersProps) {
  const router = useRouter();
  const [banners, setBanners] = useState<BannerVM[]>([]);
  const [ix, setIx] = useState(0);
  const count = banners.length;
  const isCheckout = placement === 'checkout';

  const handleBannerClick = useCallback(
    async (banner: BannerVM) => {
      if (isCheckout) return;
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  useEffect(() => {
    if (count > 0) setIx((prev) => prev % count);
  }, [count]);

  if (count === 0) return null;

  const source = CLICK_SOURCE[placement];

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl min-h-[140px] text-white shadow-md">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`${index === ix ? 'block' : 'hidden'}`}
            style={{
              backgroundImage: banner.imageUrl
                ? `linear-gradient(90deg, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.35) 45%, rgba(0, 0, 0, 0.15) 100%), url("${banner.imageUrl}")`
                : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientTo} 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm leading-tight line-clamp-2">{banner.title}</h3>
                {banner.subtitle ? <p className="text-xs text-white/90 mt-1 line-clamp-2">{banner.subtitle}</p> : null}
                {isCheckout ? (
                  <p className="mt-3 inline-block text-xs font-medium text-white/90">{banner.ctaText}</p>
                ) : (
                  <button
                    type="button"
                    className="mt-3 inline-block bg-white/95 text-[#FF8C42] px-3 py-1.5 rounded-full text-xs font-semibold"
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
              {banner.imageUrl ? null : <banner.Icon className="w-8 h-8 shrink-0 text-white/95" aria-hidden />}
            </div>
          </div>
        ))}
        {count > 1 ? (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
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
