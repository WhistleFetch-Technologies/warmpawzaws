'use client';

import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { HOME_VISIT_TRUST_ITEMS } from './constants/home-visit-service-catalog';

function HomeVisitTrustSectionComponent() {
  return (
    <section className="mt-8" aria-label="Why choose home visit">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
            <Sparkles className="h-4 w-4 text-emerald-600" strokeWidth={2} aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-gray-900">Why choose Home Visit?</h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {HOME_VISIT_TRUST_ITEMS.map((item, index) => {
            const Icon = item.Icon;
            return (
              <div
                key={item.id}
                className="home-visit-fade-in flex min-w-0 items-center gap-2 rounded-2xl border border-white bg-white px-2.5 py-3 shadow-sm"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${item.iconColor}`} strokeWidth={2} aria-hidden />
                </span>
                <p className="min-w-0 text-[10px] font-semibold leading-snug text-gray-800">{item.title}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const HomeVisitTrustSection = memo(HomeVisitTrustSectionComponent);
