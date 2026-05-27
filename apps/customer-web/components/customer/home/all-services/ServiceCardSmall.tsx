'use client';

import React, { memo } from 'react';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';
import type { AllServicesTile } from './useAllServicesData';

export interface ServiceCardSmallProps {
  service: AllServicesTile;
  onPress: (service: AllServicesTile) => void;
}

function ServiceCardSmallComponent({ service, onPress }: ServiceCardSmallProps) {
  const screen = String(service.screen || '').toLowerCase();
  const key = String(service.categoryId || service.screen || '').toLowerCase();
  const isComingSoon =
    Boolean(service.isComingSoon) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(screen) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(key);

  if (isComingSoon) {
    return (
      <div
        className="pointer-events-none flex select-none flex-col items-center gap-1.5 opacity-75"
        aria-label={`${service.displayLabel} — coming soon`}
      >
        <div
          className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${service.color}`}
        >
          <service.icon className="h-6 w-6" aria-hidden />
          <span className="absolute -top-1 -right-1 rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white">
            Soon
          </span>
        </div>
        <span className="max-w-[4.5rem] text-center text-[10px] font-medium leading-tight text-gray-500 line-clamp-2">
          {service.displayLabel}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1.5 active:opacity-90"
      aria-label={`${service.displayLabel}, open service`}
      onClick={() => onPress(service)}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform hover:scale-105 ${service.color}`}
      >
        <service.icon className="h-6 w-6" aria-hidden />
      </div>
      <span className="max-w-[4.5rem] text-center text-[10px] font-medium leading-tight text-gray-700 line-clamp-2">
        {service.displayLabel}
      </span>
    </button>
  );
}

/** 4-column compact service tile for "More Services". */
export const ServiceCardSmall = memo(ServiceCardSmallComponent);
