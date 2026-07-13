'use client';

import React, { memo } from 'react';
import { HOME_VISIT_TIMELINE_STEPS } from './constants/home-visit-service-catalog';

function HomeVisitTimelineComponent() {
  return (
    <section className="mt-8" aria-label="How it works">
      <h2 className="mb-4 text-lg font-bold text-gray-900">How it works</h2>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex min-w-max items-start gap-0 pb-1">
          {HOME_VISIT_TIMELINE_STEPS.map((step, index) => {
            const Icon = step.Icon;
            const isLast = index === HOME_VISIT_TIMELINE_STEPS.length - 1;
            return (
              <div key={step.id} className="flex items-start">
                <div className="flex w-[5.25rem] flex-col items-center">
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50 shadow-sm">
                    <Icon className="h-5 w-5 text-emerald-600" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="max-w-[5.25rem] text-center text-[10px] font-semibold leading-snug text-gray-700">
                    {step.label}
                  </p>
                </div>
                {!isLast ? (
                  <div className="mt-5 flex h-0.5 w-5 items-center" aria-hidden>
                    <div className="h-px w-full bg-gradient-to-r from-emerald-300 to-emerald-100" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const HomeVisitTimeline = memo(HomeVisitTimelineComponent);
