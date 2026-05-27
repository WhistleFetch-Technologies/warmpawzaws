'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { ChevronRight, Sparkles } from 'lucide-react';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import { usePopularServiceCatalog } from '../hooks/usePopularServiceCatalog';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface PopularServicesSectionProps {
  phone?: string;
  onNavigate: HomeNavigateFn;
  className?: string;
}

function PopularServicesSectionComponent({
  phone,
  onNavigate,
  className = '',
}: PopularServicesSectionProps) {
  const { items } = usePopularServiceCatalog(phone);

  if (items.length === 0) return null;

  return (
    <div className={`mb-6 ${className}`}>
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#FF8C42]" />
          <h2 className="font-semibold text-gray-900">Popular Services</h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('grooming')}
          className="flex items-center gap-1 text-xs font-medium text-[#FF8C42]"
        >
          View all <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <HorizontalScrollRow gapClassName="gap-4" paddingClassName="px-4">
        {items.map((item) => {
          const Icon = item.icon;
          const priceLabel =
            item.priceFrom != null && item.priceFrom > 0
              ? `From ₹${Math.round(item.priceFrom)}`
              : 'Explore';

          return (
            <div
              key={item.id}
              className="w-40 flex-shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              onClick={() => onNavigate(item.screen)}
            >
              <div className="p-3 pb-0">
                <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-pink-50">
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="160px"
                    unoptimized
                  />
                  <span
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/90 bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-[2px]"
                    aria-hidden
                  >
                    <Icon
                      className="h-[18px] w-[18px]"
                      style={{ color: item.iconColor }}
                      strokeWidth={1.85}
                    />
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="mb-0.5 text-sm font-semibold text-gray-900">{item.title}</h3>
                <p className="mb-2 line-clamp-2 text-[11px] leading-snug text-gray-600">
                  {item.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#FF8C42]">{priceLabel}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-[#FF8C42] px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-[#FF7A2E]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(item.screen);
                    }}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </HorizontalScrollRow>
    </div>
  );
}

/** Category spotlight cards — navigation matches legacy grooming "View all" routes. */
export const PopularServicesSection = memo(PopularServicesSectionComponent);
