'use client';

import React, { memo, useCallback } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { SectionHeader } from '../shared/SectionHeader';
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
        sizes="120px"
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
          className="mb-3"
        />
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-pink-50">
              <CardImage src={item.imageUrl} alt={item.title} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-1 text-sm font-semibold text-gray-900">{item.title}</h4>
              <p className="line-clamp-1 text-[11px] text-gray-500">{item.description}</p>
            </div>
            <button
              type="button"
              onClick={() => handleBook(item)}
              className="shrink-0 rounded-full bg-[#FF8C42] px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-[#FF7A2E]"
            >
              Book Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Personalized recommendation cards with Book Now navigation. */
export const ForYouCardsSection = memo(ForYouCardsSectionComponent);
