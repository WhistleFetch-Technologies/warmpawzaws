'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  ChevronRight,
  Headphones,
  Heart,
  PawPrint,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import { HELP_WAYS_CATALOG } from '../constants/help-ways-catalog';
import {
  getHelpWayTheme,
  HELP_WAY_SOON_IDS,
} from '../constants/help-ways-theme';
import { COMING_SOON_HOME_SERVICE_SCREENS, type QuickServiceTile } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const POLICY_COMING_SOON_SCREENS = new Set([
  'insurance',
  'adoption',
  'cafes',
  'mating-dating-hub',
  'breeder',
]);

const SECTION_TRUST_ITEMS = [
  {
    id: 'trusted',
    title: 'Trusted & Safe',
    subtitle: 'Verified professionals & secure services',
    Icon: Shield,
    iconBg: 'bg-[#FF8C42]',
  },
  {
    id: 'quality',
    title: 'Quality Assured',
    subtitle: 'Top-rated experts near you',
    Icon: ShieldCheck,
    iconBg: 'bg-emerald-500',
  },
  {
    id: 'support',
    title: '24/7 Support',
    subtitle: "We're here for you anytime",
    Icon: Headphones,
    iconBg: 'bg-violet-500',
  },
  {
    id: 'pet-first',
    title: 'Pet First',
    subtitle: "Everything for your pet's well-being",
    Icon: Heart,
    iconBg: 'bg-rose-500',
  },
] as const;

function WayCardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <CachedImage
      src={src}
      alt={alt}
      width={56}
      height={56}
      className="h-14 w-14 rounded-full object-cover ring-2 ring-white/90"
    />
  );
}

export interface HelpWaysSectionProps {
  services: QuickServiceTile[];
  customerCommerceEnabled: boolean;
  onNavigate: HomeNavigateFn;
  className?: string;
  /** When true, under-build cards are removed entirely (not shown as Soon). */
  reviewDemoAccount?: boolean;
}

function HelpWaysSectionComponent({
  services,
  customerCommerceEnabled,
  onNavigate,
  className = '',
  reviewDemoAccount = false,
}: HelpWaysSectionProps) {
  const launchByScreen = useMemo(() => {
    const map = new Map<string, QuickServiceTile>();
    for (const tile of services) {
      map.set(String(tile.screen || '').toLowerCase(), tile);
      map.set(String(tile.categoryId || '').toLowerCase(), tile);
    }
    return map;
  }, [services]);

  const resolveComingSoon = useCallback(
    (screen: string, categoryId: string) => {
      const screenKey = screen.toLowerCase();
      const categoryKey = categoryId.toLowerCase();
      if (screenKey === 'shop' && !customerCommerceEnabled) return true;
      if (
        POLICY_COMING_SOON_SCREENS.has(screenKey) ||
        POLICY_COMING_SOON_SCREENS.has(categoryKey)
      ) {
        return true;
      }
      if (
        COMING_SOON_HOME_SERVICE_SCREENS.has(screenKey) ||
        COMING_SOON_HOME_SERVICE_SCREENS.has(categoryKey)
      ) {
        return true;
      }
      const tile = launchByScreen.get(screenKey) || launchByScreen.get(categoryKey);
      return Boolean(tile?.isComingSoon);
    },
    [customerCommerceEnabled, launchByScreen]
  );

  const handlePress = useCallback(
    (screen: string, categoryId: string) => {
      if (resolveComingSoon(screen, categoryId)) {
        toast.info('This service is coming soon in your area.');
        return;
      }
      onNavigate(screen);
    },
    [onNavigate, resolveComingSoon]
  );

  return (
    <div className={`mb-6 ${className}`}>
      <div className="mb-4 px-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E6]">
            <PawPrint className="h-4 w-4 text-[#FF8C42]" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug text-[#1E2A4A]">
              More ways we can help
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              Explore expert-backed services for your pet&apos;s health, happiness &amp; well-being.
            </p>
          </div>
        </div>
      </div>

      <HorizontalScrollRow gapClassName="gap-3">
        {HELP_WAYS_CATALOG.map((way) => {
          const comingSoon = resolveComingSoon(way.screen, way.categoryId);
          if (reviewDemoAccount && comingSoon) return null;
          const showSoonBadge = HELP_WAY_SOON_IDS.has(way.id) && comingSoon;
          const theme = getHelpWayTheme(way.id);
          const BadgeIcon = theme.badgeIcon;
          const WatermarkIcon = theme.watermarkIcon;

          return (
            <div
              key={way.id}
              className={`relative flex w-[9.5rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-orange-100/80 p-3 shadow-sm ${theme.cardBg}`}
            >
              <WatermarkIcon
                className={`pointer-events-none absolute -right-1 bottom-10 h-16 w-16 opacity-[0.07] ${theme.watermarkClass}`}
                strokeWidth={1.25}
                aria-hidden
              />

              {showSoonBadge ? (
                <span
                  className={`absolute right-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white ${theme.accentLight}`}
                >
                  Soon
                </span>
              ) : null}

              <div className="relative mb-2.5 h-14 w-14 shrink-0 self-start">
                <WayCardImage src={way.imageUrl} alt={way.title} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-white shadow-sm ${theme.accentLight}`}
                  aria-hidden
                >
                  <BadgeIcon className="h-2.5 w-2.5" strokeWidth={2.25} />
                </span>
              </div>

              <h3 className="mb-0.5 text-sm font-semibold leading-tight text-gray-900">{way.title}</h3>
              <p className="mb-2 line-clamp-2 min-h-[2.25rem] text-[10px] leading-snug text-gray-600">
                {way.description}
              </p>

              <div className="mb-2.5 flex flex-col gap-1">
                {theme.featureTags.map(({ label, Icon }) => (
                  <span
                    key={label}
                    className="inline-flex w-fit max-w-full items-center gap-0.5 rounded-md bg-white/75 px-1.5 py-0.5 text-[8px] font-medium leading-tight text-gray-600"
                  >
                    <Icon className={`h-2.5 w-2.5 shrink-0 ${theme.accent}`} strokeWidth={2} />
                    <span className="truncate">{label}</span>
                  </span>
                ))}
              </div>

              <button
                type="button"
                disabled={comingSoon}
                onClick={() => handlePress(way.screen, way.categoryId)}
                className={`mt-auto flex items-center gap-1 text-xs font-semibold ${
                  comingSoon
                    ? 'cursor-not-allowed opacity-70'
                    : `${theme.accent} hover:opacity-90`
                }`}
              >
                Explore
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${theme.accentLight}`}
                  aria-hidden
                >
                  <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                </span>
              </button>
            </div>
          );
        })}
      </HorizontalScrollRow>

      <div className="mx-4 mt-4 rounded-2xl border border-gray-100 bg-white px-2 py-3 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SECTION_TRUST_ITEMS.map(({ id, title, subtitle, Icon, iconBg }) => (
            <div key={id} className="flex min-w-0 items-center gap-2 px-1">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${iconBg}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[#1E2A4A]">{title}</p>
                <p className="truncate text-[9px] leading-snug text-gray-500">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Horizontal help cards — insurance, nutrition, training, shop. */
export const HelpWaysSection = memo(HelpWaysSectionComponent);
