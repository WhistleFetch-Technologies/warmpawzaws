'use client';

import React, { memo } from 'react';
import { HOME_VISIT_QUICK_STATS } from './constants/home-visit-service-catalog';

function HomeVisitQuickStatsComponent() {
  return (
    <div className="relative z-20 -mt-5 px-4 sm:-mt-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {HOME_VISIT_QUICK_STATS.map((stat, index) => {
          const Icon = stat.Icon;
          return (
            <div
              key={stat.id}
              className="home-visit-fade-in flex min-w-0 items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-2.5 py-2.5 shadow-[0_8px_24px_rgba(16,185,129,0.12)] backdrop-blur-md sm:px-3 sm:py-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <Icon className="h-4 w-4 text-emerald-600" strokeWidth={2} aria-hidden />
              </span>
              <p className="min-w-0 text-[10px] font-semibold leading-snug text-gray-800 sm:text-[11px]">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const HomeVisitQuickStats = memo(HomeVisitQuickStatsComponent);
