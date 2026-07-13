'use client';

import React, { memo } from 'react';
import { HorizontalScrollRow } from '../home/shared/HorizontalScrollRow';
import { HOME_VISIT_QUICK_STATS } from './constants/home-visit-service-catalog';

function HomeVisitQuickStatsComponent() {
  return (
    <div className="relative z-20 -mt-4 px-4">
      <HorizontalScrollRow gapClassName="gap-2" paddingClassName="px-0">
        {HOME_VISIT_QUICK_STATS.map((stat, index) => {
          const Icon = stat.Icon;
          return (
            <div
              key={stat.id}
              className="home-visit-fade-in flex min-w-[8.5rem] flex-shrink-0 items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(16,185,129,0.12)] backdrop-blur-md"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <Icon className="h-4 w-4 text-emerald-600" strokeWidth={2} aria-hidden />
              </span>
              <p className="min-w-0 text-[10px] font-semibold leading-snug text-gray-800">
                {stat.label}
              </p>
            </div>
          );
        })}
      </HorizontalScrollRow>
    </div>
  );
}

export const HomeVisitQuickStats = memo(HomeVisitQuickStatsComponent);
