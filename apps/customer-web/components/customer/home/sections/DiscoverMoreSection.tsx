'use client';

import React, { memo } from 'react';
import { ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
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

  if (
    (trendingLoading && trendingItems.length === 0) ||
    (forYouLoading && forYouItems.length === 0)
  ) {
    return null;
  }

  const showTrending = trendingItems.length > 0;
  const showForYou = forYouItems.length > 0;

  if (!showTrending && !showForYou) return null;

  return (
    <div className={`mb-6 ${className}`}>
      <SectionHeader title="Discover more" className="mb-3" />
      <div className="flex w-full flex-col gap-4 px-4">
        {showTrending ? (
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#FF8C42]" />
                <h3 className="text-sm font-semibold text-gray-900">Trending Now</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('problem_grid')}
                className="flex items-center gap-0.5 text-[11px] font-medium text-[#FF8C42]"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <TrendingNowSection items={trendingItems} onNavigate={onNavigate} embedded />
          </div>
        ) : null}
        {showForYou ? (
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF8C42]" />
                <h3 className="text-sm font-semibold text-gray-900">For you</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/services/all')}
                className="flex items-center gap-0.5 text-[11px] font-medium text-[#FF8C42]"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <ForYouCardsSection items={forYouItems} onNavigate={onNavigate} embedded />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Vertical discover block — trending problems, then personalized picks. */
export const DiscoverMoreSection = memo(DiscoverMoreSectionComponent);
