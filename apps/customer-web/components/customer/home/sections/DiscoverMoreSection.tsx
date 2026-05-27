'use client';

import React, { memo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { useTrendingProblems } from '../hooks/useTrendingProblems';
import { useForYouRecommendations } from '../hooks/useForYouRecommendations';
import { TrendingNowSection } from './TrendingNowSection';
import { ForYouCardsSection } from './ForYouCardsSection';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface DiscoverMoreSectionProps {
  phone?: string;
  onNavigate: HomeNavigateFn;
  className?: string;
}

function DiscoverMoreSectionComponent({
  phone,
  onNavigate,
  className = '',
}: DiscoverMoreSectionProps) {
  const { items: trendingItems, loading: trendingLoading } = useTrendingProblems(5);
  const { items: forYouItems, loading: forYouLoading } = useForYouRecommendations(phone);

  if (trendingLoading || forYouLoading) return null;

  const showTrending = trendingItems.length > 0;
  const showForYou = forYouItems.length > 0;

  if (!showTrending && !showForYou) return null;

  return (
    <div className={`mb-6 ${className}`}>
      <SectionHeader title="Discover more" className="mb-3" />
      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2">
        {showTrending ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF8C42]" />
              <h3 className="text-sm font-semibold text-gray-900">Trending Now</h3>
            </div>
            <TrendingNowSection items={trendingItems} onNavigate={onNavigate} embedded />
          </div>
        ) : null}
        {showForYou ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF8C42]" />
              <h3 className="text-sm font-semibold text-gray-900">For you</h3>
            </div>
            <ForYouCardsSection items={forYouItems} onNavigate={onNavigate} embedded />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Two-column discover block — trending problems + personalized picks. */
export const DiscoverMoreSection = memo(DiscoverMoreSectionComponent);
