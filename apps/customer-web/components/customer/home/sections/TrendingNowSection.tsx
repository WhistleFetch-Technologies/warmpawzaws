'use client';

import React, { memo, useCallback } from 'react';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { trendingRoleIdToCategorySlug } from '../utils/trending-category';
import type { TrendingProblem } from '../hooks/useTrendingProblems';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface TrendingNowSectionProps {
  items: TrendingProblem[];
  onNavigate: HomeNavigateFn;
  className?: string;
  /** When true, omit outer section header (used inside DiscoverMoreSection). */
  embedded?: boolean;
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

      <div className="space-y-2.5">
        {items.map((problem, index) => (
          <button
            key={problem.problemId || `${problem.title}-${index}`}
            type="button"
            onClick={() => handleProblemSelect(problem)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                index === 0
                  ? 'bg-gradient-to-r from-[#FF8C42] to-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-1 text-sm font-medium text-gray-900">{problem.title}</h4>
              <p className="text-[11px] text-gray-500">
                {Number(problem.searchCount || 0)} searches
                {problem.category ? (
                  <>
                    <span className="mx-1">•</span>
                    <span className="capitalize">{problem.category}</span>
                  </>
                ) : null}
              </p>
            </div>
            <TrendingUp
              className={`h-4 w-4 shrink-0 ${
                problem.trend === 'up'
                  ? 'text-green-600'
                  : problem.trend === 'down'
                    ? 'rotate-180 text-red-600'
                    : 'text-gray-300'
              }`}
              aria-hidden
            />
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF8C42]" />
          </button>
        ))}
      </div>

      {embedded ? (
        <button
          type="button"
          onClick={() => onNavigate('problem_grid')}
          className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#FF8C42]"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Ranked trending problems list with problem_grid / services_by_problem navigation. */
export const TrendingNowSection = memo(TrendingNowSectionComponent);
