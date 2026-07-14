'use client';

import React, { memo } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import { ServiceDescriptionInline } from '../../shared/ServiceDescriptionInline';
import { getCategoryCardImageUrl } from '../constants/category-card-images';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';
import { getServiceAccent } from './serviceAccentColors';
import type { AllServicesTile } from './useAllServicesData';

export interface ServiceCardLargeProps {
  service: AllServicesTile;
  onPress: (service: AllServicesTile) => void;
  index?: number;
}

function CategoryCardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <CachedImage
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 480px) 45vw, 200px"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

function ServiceCardLargeComponent({ service, onPress, index = 0 }: ServiceCardLargeProps) {
  const screen = String(service.screen || '').toLowerCase();
  const key = String(service.categoryId || service.screen || '').toLowerCase();
  const isComingSoon =
    Boolean(service.isComingSoon) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(screen) ||
    COMING_SOON_HOME_SERVICE_SCREENS.has(key);

  const imageUrl =
    service.imageUrl ||
    getCategoryCardImageUrl(service.screen) ||
    getCategoryCardImageUrl(service.categoryId);

  const accent = getServiceAccent(service.screen || service.categoryId);
  const staggerDelay = `${Math.min(index, 6) * 60}ms`;

  const tileInner = (
    <div
      className={`group relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${accent.gradient} p-0 shadow-sm ring-1 ${accent.ring} transition-all duration-300 ${
        isComingSoon
          ? 'opacity-75 grayscale-[0.12]'
          : `${accent.glow} hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]`
      }`}
      style={{ animationDelay: staggerDelay }}
    >
      {isComingSoon ? (
        <span className="absolute right-3 top-3 z-20 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Soon
        </span>
      ) : null}

      <div className="relative h-[88px] w-full overflow-hidden">
        {imageUrl ? (
          <CategoryCardImage src={imageUrl} alt={service.displayLabel} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/40">
            <service.icon className="h-10 w-10 opacity-80" aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
        {!isComingSoon ? (
          <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm">
            <ArrowUpRight className="h-3.5 w-3.5 text-gray-600" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1">
        <h3 className="mb-0.5 text-sm font-bold leading-tight text-gray-900">
          {service.displayLabel}
        </h3>
        {isComingSoon ? (
          <p className="m-0 text-[11px] text-gray-500">Coming soon in your area</p>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="line-clamp-2 text-[11px] leading-snug text-gray-500"
          >
            <ServiceDescriptionInline
              description={service.description}
              title={service.displayLabel}
              className="m-0 text-[11px] leading-snug text-gray-500"
              linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-[#FF8C42] hover:underline"
            />
          </div>
        )}
      </div>
    </div>
  );

  if (isComingSoon) {
    return (
      <div
        className="pointer-events-none select-none text-left animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
        style={{ animationDelay: staggerDelay }}
        aria-label={`${service.displayLabel} — coming soon`}
      >
        {tileInner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="animate-in fade-in slide-in-from-bottom-2 text-left duration-500 fill-mode-both active:opacity-90"
      style={{ animationDelay: staggerDelay }}
      aria-label={`${service.displayLabel}, open service`}
      onClick={() => onPress(service)}
    >
      {tileInner}
    </button>
  );
}

/** 2-column large service card for "Services for You". */
export const ServiceCardLarge = memo(ServiceCardLargeComponent);
