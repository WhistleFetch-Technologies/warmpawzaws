'use client';

import React, { memo, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import { SectionHeader } from '../shared/SectionHeader';
import { HELP_WAYS_CATALOG } from '../constants/help-ways-catalog';
import { COMING_SOON_HOME_SERVICE_SCREENS, type QuickServiceTile } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const POLICY_COMING_SOON_SCREENS = new Set([
  'insurance',
  'adoption',
  'cafes',
  'mating-dating-hub',
  'breeder',
]);

function WayCardImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={56}
        height={56}
        className="mb-3 h-14 w-14 rounded-2xl object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="mb-3 h-14 w-14 overflow-hidden rounded-2xl">
      <PresignableImage src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export interface HelpWaysSectionProps {
  services: QuickServiceTile[];
  customerCommerceEnabled: boolean;
  onNavigate: HomeNavigateFn;
  className?: string;
}

function HelpWaysSectionComponent({
  services,
  customerCommerceEnabled,
  onNavigate,
  className = '',
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
      <SectionHeader title="More ways we can help" className="mb-3" />
      <HorizontalScrollRow gapClassName="gap-3">
        {HELP_WAYS_CATALOG.map((way) => {
          const comingSoon = resolveComingSoon(way.screen, way.categoryId);
          return (
            <div
              key={way.id}
              className={`relative w-[9.5rem] flex-shrink-0 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm ${
                comingSoon ? 'opacity-80 grayscale-[0.08]' : ''
              }`}
            >
              {comingSoon ? (
                <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Soon
                </span>
              ) : null}
              <WayCardImage src={way.imageUrl} alt={way.title} />
              <h3 className="mb-0.5 text-sm font-semibold text-gray-900">{way.title}</h3>
              <p className="mb-3 line-clamp-2 text-[11px] leading-snug text-gray-600">
                {way.description}
              </p>
              <button
                type="button"
                disabled={comingSoon}
                onClick={() => handlePress(way.screen, way.categoryId)}
                className={`flex items-center gap-0.5 text-xs font-semibold ${
                  comingSoon
                    ? 'cursor-not-allowed text-amber-600'
                    : 'text-[#FF8C42] hover:text-[#FF7A2E]'
                }`}
              >
                Explore <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </HorizontalScrollRow>
    </div>
  );
}

/** Horizontal help cards — insurance, nutrition, training, shop. */
export const HelpWaysSection = memo(HelpWaysSectionComponent);
