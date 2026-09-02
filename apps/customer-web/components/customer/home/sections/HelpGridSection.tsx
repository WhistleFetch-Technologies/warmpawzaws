'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { COMING_SOON_HOME_SERVICE_SCREENS, type QuickServiceTile } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

/** Primary row tiles — excluded from the help grid. */
const PRIMARY_HOME_SCREENS = new Set(['vet', 'grooming', 'shop', 'training']);

/** Product policy: always non-interactive on home even when listed in launch config. */
const POLICY_COMING_SOON_SCREENS = new Set([
  'insurance',
  'adoption',
  'cafes',
  'mating-dating-hub',
  'breeder',
]);

const SECONDARY_DESCRIPTIONS: Record<string, string> = {
  pharmacy: 'Medicines & supplements',
  'lab-diagnostics': 'Lab tests & reports',
  walker: 'Daily walks & exercise',
  boarding: 'Safe stay for your pet',
  'pet-sitter': 'In-home pet sitting',
  nutritionist: 'Meal plans & diet advice',
  nutrition: 'Meal plans & diet advice',
  behaviorist: 'Behavior correction',
  training: 'Obedience & skills',
  ambulance: 'Emergency transport',
  photography: 'Pet photo sessions',
  relocation: 'Pet relocation help',
  resort: 'Luxury pet resort',
  holiday: 'Pet-friendly holidays',
  sunset: 'End-of-life care',
  insurance: 'Full coverage',
};

export interface HelpGridSectionProps {
  /** Launch-config resolved tiles (same pool as ServiceCategoryRow). */
  services: QuickServiceTile[];
  onNavigate: HomeNavigateFn;
  serviceLabelOverride?: Record<string, string>;
  className?: string;
}

function displayLabelForService(
  service: QuickServiceTile,
  serviceLabelOverride?: Record<string, string>
): string {
  const key = ((service.categoryId || service.screen || '') as string).toLowerCase();
  return serviceLabelOverride?.[key] ?? service.label;
}

function HelpGridSectionComponent({
  services,
  onNavigate,
  serviceLabelOverride,
  className = '',
}: HelpGridSectionProps) {
  const secondaryTiles = useMemo(() => {
    return services.filter((service) => {
      const screen = String(service.screen || '').toLowerCase();
      const categoryId = String(service.categoryId || '').toLowerCase();
      if (PRIMARY_HOME_SCREENS.has(screen) || PRIMARY_HOME_SCREENS.has(categoryId)) {
        return false;
      }
      return true;
    });
  }, [services]);

  const handleTileClick = useCallback(
    (service: QuickServiceTile) => {
      const isComingSoonTile = Boolean(service.isComingSoon);
      if (isComingSoonTile) {
        toast.info('This service is coming soon in your area.');
        return;
      }
      onNavigate(service.screen);
    },
    [onNavigate]
  );

  return (
    <div className={`mb-6 px-4 ${className}`}>
      <h2 className="mb-3 font-semibold text-gray-900">More ways we can help</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-orange-50/80 p-4 text-left transition-all hover:shadow-md active:opacity-90"
          onClick={() => onNavigate('/events')}
        >
          <Calendar className="mb-2 h-8 w-8 text-[#FF8C42]" />
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Events</h3>
          <p className="text-xs text-gray-600">Pet meetups, workshops & more</p>
        </button>
        {secondaryTiles.map((service, index) => {
          const screen = String(service.screen || '').toLowerCase();
          const key = ((service.categoryId || service.screen || '') as string).toLowerCase();
          const displayLabel = displayLabelForService(service, serviceLabelOverride);
          const description =
            SECONDARY_DESCRIPTIONS[key] ||
            SECONDARY_DESCRIPTIONS[screen] ||
            'Explore this service';

          const policyComingSoon = POLICY_COMING_SOON_SCREENS.has(screen) || POLICY_COMING_SOON_SCREENS.has(key);
          const catalogComingSoon =
            COMING_SOON_HOME_SERVICE_SCREENS.has(screen) || COMING_SOON_HOME_SERVICE_SCREENS.has(key);
          const launchComingSoon = Boolean(service.isComingSoon);
          const isComingSoon = policyComingSoon || catalogComingSoon || launchComingSoon;

          if (isComingSoon) {
            return (
              <div
                key={service.screen || index}
                className="relative rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50/90 to-gray-100/90 p-4 text-left opacity-[0.88] grayscale-[0.12] pointer-events-none select-none"
                aria-label={`${displayLabel} — coming soon`}
              >
                <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Soon
                </span>
                <service.icon className="mb-2 h-8 w-8 text-gray-600/80" />
                <h3 className="mb-1 text-sm font-semibold text-gray-800">{displayLabel}</h3>
                <p className="mb-2 text-xs text-gray-600">{description}</p>
                <span className="text-xs font-semibold text-amber-600">Coming soon</span>
              </div>
            );
          }

          return (
            <button
              key={service.screen || index}
              type="button"
              className={`rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/80 p-4 text-left transition-all hover:shadow-md active:opacity-90 ${service.color}`}
              onClick={() => handleTileClick(service)}
            >
              <service.icon className="mb-2 h-8 w-8" />
              <h3 className="mb-1 text-sm font-semibold text-gray-800">{displayLabel}</h3>
              <p className="text-xs text-gray-600">{description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 2-column grid of launch-visible secondary services (insurance, nutrition, training, etc.). */
export const HelpGridSection = memo(HelpGridSectionComponent);
