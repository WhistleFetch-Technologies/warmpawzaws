'use client';

import React, { memo, useCallback } from 'react';
import Image from 'next/image';
import { ChevronRight, Sparkles } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { SectionHeader } from '../shared/SectionHeader';
import { getForYouCardTheme } from '../utils/for-you-card-theme';
import type { ForYouRecommendationItem } from '../hooks/useForYouRecommendations';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

function CardImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="h-16 w-16 rounded-full object-cover ring-2 ring-white/90"
        unoptimized
      />
    );
  }
  return (
    <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/90">
      <PresignableImage src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export interface ForYouCardsSectionProps {
  items: ForYouRecommendationItem[];
  onNavigate: HomeNavigateFn;
  className?: string;
  embedded?: boolean;
}

function ForYouCardsSectionComponent({
  items,
  onNavigate,
  className = '',
  embedded = false,
}: ForYouCardsSectionProps) {
  const handleBook = useCallback(
    (item: ForYouRecommendationItem) => {
      onNavigate(item.screen, item.serviceId ? { serviceId: item.serviceId } : undefined);
    },
    [onNavigate]
  );

  if (items.length === 0) return null;

  return (
    <div className={className}>
      {embedded ? null : (
        <SectionHeader
          title="For you"
          icon={<Sparkles className="h-4 w-4 text-[#FF8C42]" />}
          actionLabel="View all"
          onAction={() => onNavigate('/services/all')}
          className="mb-3"
        />
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const theme = getForYouCardTheme(item.screen, item.id);
          const OverlayIcon = theme.overlayIcon;
          const BackgroundIcon = theme.backgroundIcon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleBook(item)}
              className="group relative flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md active:scale-[0.99]"
            >
              <div className="relative h-16 w-16 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <CardImage src={item.imageUrl} alt={item.title} />
                <span
                  className={`absolute -left-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-white shadow-sm transition-transform duration-200 group-hover:scale-110 ${theme.overlayBgClass}`}
                  aria-hidden
                >
                  <OverlayIcon className={`h-2.5 w-2.5 ${theme.overlayIconClass}`} strokeWidth={2.25} />
                </span>
              </div>

              {/* Content with faded background icon */}
              <div className="relative min-w-0 flex-1">
                <BackgroundIcon
                  className={`pointer-events-none absolute -right-1 bottom-0 h-16 w-16 ${theme.backgroundIconClass} opacity-[0.35] transition-opacity duration-200 group-hover:opacity-50`}
                  strokeWidth={1.25}
                  aria-hidden
                />
                <h4 className="relative line-clamp-1 text-sm font-semibold text-gray-900 transition-colors group-hover:text-[#FF8C42]">
                  {item.title}
                </h4>
                <p className="relative mt-0.5 line-clamp-1 text-[11px] text-gray-500">{item.description}</p>
                <div className="relative mt-2 flex flex-wrap gap-1.5">
                  {theme.badges.map((badge) => {
                    const BadgeIcon = badge.Icon;
                    return (
                      <span
                        key={badge.label}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium text-gray-700 transition-colors ${badge.bgClass} group-hover:bg-white`}
                      >
                        <BadgeIcon className={`h-3 w-3 shrink-0 ${badge.iconClass}`} strokeWidth={2} aria-hidden />
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Book Now + chevron */}
              <div className="flex shrink-0 items-center gap-1">
                <span className="rounded-full bg-[#FF8C42] px-3.5 py-1.5 text-[10px] font-semibold text-white transition-colors group-hover:bg-[#FF7A2E]">
                  Book Now
                </span>
                <ChevronRight
                  className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF8C42]"
                  aria-hidden
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Personalized recommendation cards with Book Now navigation. */
export const ForYouCardsSection = memo(ForYouCardsSectionComponent);
