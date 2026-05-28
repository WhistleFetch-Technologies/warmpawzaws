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
        fill
        className="object-cover"
        sizes="96px"
        unoptimized
      />
    );
  }
  return <PresignableImage src={src} alt={alt} className="h-full w-full object-cover" />;
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
            <div
              key={item.id}
              className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              {/* Image with overlay icon */}
              <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-pink-50">
                <CardImage src={item.imageUrl} alt={item.title} />
                <div
                  className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${theme.overlayBgClass}`}
                >
                  <OverlayIcon className={`h-3.5 w-3.5 ${theme.overlayIconClass}`} strokeWidth={2} aria-hidden />
                </div>
              </div>

              {/* Content with faded background icon */}
              <div className="relative min-w-0 flex-1">
                <BackgroundIcon
                  className={`pointer-events-none absolute -right-1 bottom-0 h-16 w-16 ${theme.backgroundIconClass} opacity-[0.35]`}
                  strokeWidth={1.25}
                  aria-hidden
                />
                <h4 className="relative line-clamp-1 text-sm font-semibold text-gray-900">{item.title}</h4>
                <p className="relative mt-0.5 line-clamp-1 text-[11px] text-gray-500">{item.description}</p>
                <div className="relative mt-2 flex flex-wrap gap-1.5">
                  {theme.badges.map((badge) => {
                    const BadgeIcon = badge.Icon;
                    return (
                      <span
                        key={badge.label}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium text-gray-700 ${badge.bgClass}`}
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
                <button
                  type="button"
                  onClick={() => handleBook(item)}
                  className="rounded-full bg-[#FF8C42] px-3.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#FF7A2E]"
                >
                  Book Now
                </button>
                <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Personalized recommendation cards with Book Now navigation. */
export const ForYouCardsSection = memo(ForYouCardsSectionComponent);
