'use client';

import React, { memo, useCallback } from 'react';
import Image from 'next/image';
import { HorizontalScrollRow } from '../home/shared/HorizontalScrollRow';
import {
  HOME_VISIT_POPULAR_ITEMS,
  type HomeVisitNavigateFn,
  type HomeVisitPopularEntry,
} from './constants/home-visit-service-catalog';

export interface HomeVisitPopularServicesProps {
  onNavigate: HomeVisitNavigateFn;
}

function HomeVisitPopularServicesComponent({ onNavigate }: HomeVisitPopularServicesProps) {
  const handlePress = useCallback(
    (item: HomeVisitPopularEntry) => {
      if (item.navigateData) {
        onNavigate(item.targetScreen, item.navigateData);
        return;
      }
      onNavigate(item.targetScreen);
    },
    [onNavigate]
  );

  return (
    <section className="mt-8" aria-label="Popular services">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">Popular Services</h2>
        <p className="mt-0.5 text-xs text-gray-500">Quick picks pet parents love</p>
      </div>

      <HorizontalScrollRow gapClassName="gap-3" paddingClassName="-mx-4 px-4">
        {HOME_VISIT_POPULAR_ITEMS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handlePress(item)}
            className="home-visit-fade-in group w-[6.75rem] flex-shrink-0 text-left"
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <div className="overflow-hidden rounded-2xl border border-emerald-100/80 bg-white shadow-sm transition-transform duration-200 active:scale-[0.98]">
              <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="108px"
                  className={
                    item.imageFit === 'contain'
                      ? 'object-contain object-bottom p-1.5'
                      : 'object-cover'
                  }
                  unoptimized
                />
                {item.imageFit !== 'contain' && (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                )}
              </div>
              <div className="px-2 py-2">
                <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-gray-900">{item.title}</p>
              </div>
            </div>
          </button>
        ))}
      </HorizontalScrollRow>
    </section>
  );
}

export const HomeVisitPopularServices = memo(HomeVisitPopularServicesComponent);
