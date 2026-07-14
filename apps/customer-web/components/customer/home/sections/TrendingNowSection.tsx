'use client';

import React, { memo, useCallback } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import { ArrowUp, ChevronRight, TrendingUp } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { trendingRoleIdToCategorySlug } from '../utils/trending-category';
import {
  Flame,
  TRENDING_AVATAR_SETS,
  TRENDING_WEEKLY_GROWTH,
  getTrendingCardImage,
  getTrendingCardTheme,
} from '../utils/trending-card-theme';
import type { TrendingProblem } from '../hooks/useTrendingProblems';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface TrendingNowSectionProps {
  items: TrendingProblem[];
  onNavigate: HomeNavigateFn;
  className?: string;
  /** When true, omit outer section header (used inside DiscoverMoreSection). */
  embedded?: boolean;
}

function formatCategoryLabel(category?: string): string {
  if (!category) return 'Veterinarian';
  const normalized = category.replace(/_/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function TrendingNowSectionComponent({
  items,
  onNavigate,
  className = '',
  embedded = false,
}: TrendingNowSectionProps) {
  const handleProblemSelect = useCallback(
    (item: TrendingProblem) => {
      const roleId = (item.category || 'veterinarian').trim();
      const category = trendingRoleIdToCategorySlug(roleId);
      onNavigate('services_by_problem', {
        problemId: item.problemId,
        problemTitle: item.title,
        roleId,
        category,
        problem: {
          problemId: item.problemId,
          title: item.title,
          name: item.title,
          roleId,
          category,
        },
      });
    },
    [onNavigate]
  );

  if (items.length === 0) return null;

  return (
    <div className={className}>
      {embedded ? null : (
        <SectionHeader
          title="Trending Now"
          icon={<TrendingUp className="h-4 w-4 text-[#FF8C42]" />}
          actionLabel="View all"
          onAction={() => onNavigate('problem_grid')}
          className="mb-3"
        />
      )}

      <div className="space-y-3">
        {items.map((problem, index) => {
          const theme = getTrendingCardTheme(index);
          const iconSrc = getTrendingCardImage(problem.title, index);
          const growth = TRENDING_WEEKLY_GROWTH[index] ?? 10;
          const avatars = TRENDING_AVATAR_SETS[index % TRENDING_AVATAR_SETS.length];

          return (
            <button
              key={problem.problemId || `${problem.title}-${index}`}
              type="button"
              onClick={() => handleProblemSelect(problem)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
            >
              {/* Category icon + rank badge */}
              <div className="relative shrink-0">
                <div className="relative h-[3.25rem] w-[3.25rem] overflow-hidden rounded-xl shadow-sm">
                  <CachedImage
                    src={iconSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="52px"
                  />
                </div>
                <div
                  className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full ${theme.badgeBg} text-[10px] font-bold text-white shadow-sm`}
                >
                  {index + 1}
                </div>
              </div>

              {/* Title, meta, trending pill */}
              <div className="min-w-0 flex-1">
                <h4 className="line-clamp-1 text-sm font-semibold text-gray-900">{problem.title}</h4>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {Number(problem.searchCount || 0)} searches
                  <span className="mx-1">•</span>
                  {formatCategoryLabel(problem.category)}
                </p>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.accentBg} ${theme.accentText}`}
                >
                  <Flame className="h-3 w-3" aria-hidden />
                  Trending
                </span>
              </div>

              {/* Growth stat, avatars, chevron */}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div
                  className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${theme.statBg} ${theme.accentText}`}
                >
                  <ArrowUp className="h-3 w-3" aria-hidden />
                  {growth}%
                  <span className="ml-0.5 font-normal opacity-80">This week</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-2">
                    {avatars.map((src, avatarIndex) => (
                      <div
                        key={src}
                        className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white bg-gray-100"
                        style={{ zIndex: avatars.length - avatarIndex }}
                      >
                        <CachedImage
                          src={src}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="24px"
                        />
                      </div>
                    ))}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF8C42]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ranked trending problems list with problem_grid / services_by_problem navigation. */
export const TrendingNowSection = memo(TrendingNowSectionComponent);
