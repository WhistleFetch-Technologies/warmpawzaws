'use client';

import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';
import type { AllServicesTile } from './useAllServicesData';

export interface ServiceCardSmallProps {
  service: AllServicesTile;
  onPress: (service: AllServicesTile) => void;
  index?: number;
}

function ServiceCardSmallComponent({ service, onPress, index = 0 }: ServiceCardSmallProps) {
  const screen = String(service.screen || '').toLowerCase();
  const key = String(service.categoryId || service.screen || '').toLowerCase();
  const isComingSoon =
    Boolean(service.isComingSoon) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(screen) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(key);

  const staggerDelay = `${Math.min(index, 10) * 40}ms`;

  if (isComingSoon) {
    return (
      <div
        className="pointer-events-none flex w-[7.5rem] flex-shrink-0 select-none flex-col items-center gap-2 opacity-70"
        style={{ animationDelay: staggerDelay }}
        aria-label={`${service.displayLabel} — coming soon`}
      >
        <div
          className={`relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl shadow-sm ring-1 ring-gray-100 ${service.color}`}
        >
          <service.icon className="h-6 w-6" aria-hidden />
          <span className="absolute -right-1 -top-1 rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white">
            Soon
          </span>
        </div>
        <span className="max-w-[7rem] text-center text-[11px] font-medium leading-tight text-gray-400 line-clamp-2">
          {service.displayLabel}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex w-[7.5rem] flex-shrink-0 flex-col items-center gap-2 active:opacity-90"
      style={{ animationDelay: staggerDelay }}
      aria-label={`${service.displayLabel}, open service`}
      onClick={() => onPress(service)}
    >
      <div className="relative">
        <div
          className={`flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl shadow-sm ring-1 ring-gray-100 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md ${service.color}`}
        >
          <service.icon className="h-6 w-6 transition-transform group-hover:scale-110" aria-hidden />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
          <ChevronRight className="h-3 w-3 text-gray-400" aria-hidden />
        </div>
      </div>
      <span className="max-w-[7rem] text-center text-[11px] font-semibold leading-tight text-gray-700 line-clamp-2">
        {service.displayLabel}
      </span>
    </button>
  );
}

/** Compact horizontal-scroll service tile for "More Services". */
export const ServiceCardSmall = memo(ServiceCardSmallComponent);
