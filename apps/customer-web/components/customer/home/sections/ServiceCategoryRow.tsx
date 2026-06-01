'use client';

import React, { memo, useCallback } from 'react';
import { toast } from 'sonner';
import { HorizontalScrollRow } from '../shared/HorizontalScrollRow';
import { SectionHeader } from '../shared/SectionHeader';
import { ServiceCategoryCard } from '../shared/ServiceCategoryCard';
import { HOME_SERVICE_DISPLAY_LABELS } from '../constants/category-card-themes';
import { COMING_SOON_HOME_SERVICE_SCREENS, type QuickServiceTile } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface ServiceCategoryRowProps {
  /** Pre-filtered service tiles (parent applies launch-config resolution). */
  services: QuickServiceTile[];
  onNavigate: HomeNavigateFn;
  /** Optional label overrides keyed by categoryId/screen (same as CustomerHomeComplete). */
  serviceLabelOverride?: Record<string, string>;
  className?: string;
}

function displayLabelForService(
  service: QuickServiceTile,
  serviceLabelOverride?: Record<string, string>
): string {
  const key = ((service.categoryId || service.screen || '') as string).toLowerCase();
  if (HOME_SERVICE_DISPLAY_LABELS[key]) {
    return HOME_SERVICE_DISPLAY_LABELS[key];
  }
  return serviceLabelOverride?.[key] ?? service.label;
}

function ServiceCategoryRowComponent({
  services,
  onNavigate,
  serviceLabelOverride,
  className = '',
}: ServiceCategoryRowProps) {
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
    <div className={`mb-4 w-full min-w-0 ${className}`}>
      <SectionHeader
        title="What's your pet need today?"
        actionLabel="View all"
        onAction={() => onNavigate('/services/all')}
        className="mb-2.5 [&_h2]:text-[15px] [&_h2]:font-bold"
      />
      <HorizontalScrollRow className="pb-0.5 pt-2" gapClassName="gap-2.5">
        {services.map((service, index) => {
          const key = ((service.categoryId || service.screen || '') as string).toLowerCase();
          const displayLabel = displayLabelForService(service, serviceLabelOverride);
          const serviceComingSoon =
            COMING_SOON_HOME_SERVICE_SCREENS.has(String(service.screen || '').toLowerCase()) ||
            COMING_SOON_HOME_SERVICE_SCREENS.has(key);

          if (serviceComingSoon) {
            return (
              <div
                key={service.screen || index}
                className="pointer-events-none flex-shrink-0 select-none opacity-75"
                aria-label={`${displayLabel} — coming soon`}
              >
                <ServiceCategoryCard
                  screen={service.screen}
                  categoryId={service.categoryId}
                  icon={service.icon}
                  color={service.color}
                  label={displayLabel}
                  showSoonBadge
                />
              </div>
            );
          }

          const isComingSoonTile = Boolean(service.isComingSoon);

          return (
            <button
              type="button"
              key={service.screen || index}
              className={`group flex-shrink-0 rounded-2xl transition-[transform,opacity,filter] duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] active:opacity-90 ${
                isComingSoonTile ? 'cursor-default' : ''
              }`}
              aria-label={
                isComingSoonTile
                  ? `${displayLabel}, coming soon in your area`
                  : `${displayLabel}, open service`
              }
              onClick={() => handleTileClick(service)}
            >
              <ServiceCategoryCard
                screen={service.screen}
                categoryId={service.categoryId}
                icon={service.icon}
                color={service.color}
                label={displayLabel}
                showSoonBadge={isComingSoonTile}
                className={
                  isComingSoonTile
                    ? 'opacity-75 saturate-75'
                    : 'shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-[box-shadow,transform] duration-300 ease-out group-hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
                }
              />
            </button>
          );
        })}
      </HorizontalScrollRow>
    </div>
  );
}

/** Horizontal service category row — launch-config tiles + header “View all”. */
export const ServiceCategoryRow = memo(ServiceCategoryRowComponent);
