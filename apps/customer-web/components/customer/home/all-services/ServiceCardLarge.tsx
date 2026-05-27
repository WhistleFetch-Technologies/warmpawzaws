'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { ServiceDescriptionInline } from '../../shared/ServiceDescriptionInline';
import { getCategoryCardImageUrl } from '../constants/category-card-images';
import { COMING_SOON_HOME_SERVICE_SCREENS } from '../types';
import type { AllServicesTile } from './useAllServicesData';

export interface ServiceCardLargeProps {
  service: AllServicesTile;
  onPress: (service: AllServicesTile) => void;
}

function CategoryCardImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('/') && !src.includes('amazonaws.com')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={72}
        height={72}
        className="mb-2 h-[4.5rem] w-[4.5rem] rounded-xl object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="mb-2 h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl">
      <PresignableImage src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

function ServiceCardLargeComponent({ service, onPress }: ServiceCardLargeProps) {
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

  const tileInner = (
    <div
      className={`relative h-full min-h-[140px] overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/90 p-4 shadow-sm transition-all ${
        isComingSoon ? 'opacity-80 grayscale-[0.08]' : 'hover:shadow-md active:scale-[0.98]'
      } ${service.color}`}
    >
      {isComingSoon ? (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Soon
        </span>
      ) : null}
      {imageUrl ? (
        <CategoryCardImage src={imageUrl} alt={service.displayLabel} />
      ) : (
        <service.icon className="mb-3 h-9 w-9" aria-hidden />
      )}
      <h3 className="mb-1 text-sm font-semibold leading-tight text-gray-900">
        {service.displayLabel}
      </h3>
      {isComingSoon ? (
        <p className="m-0 text-xs text-gray-500">Coming soon in your area</p>
      ) : (
        <div onClick={(e) => e.stopPropagation()} className="text-xs leading-snug text-gray-600">
          <ServiceDescriptionInline
            description={service.description}
            title={service.displayLabel}
            className="m-0 text-xs leading-snug text-gray-600"
            linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-[#FF8C42] hover:underline"
          />
        </div>
      )}
      {!isComingSoon ? (
        <ChevronRight
          className="absolute bottom-3 right-3 h-4 w-4 text-gray-400"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (isComingSoon) {
    return (
      <div
        className="pointer-events-none select-none text-left"
        aria-label={`${service.displayLabel} — coming soon`}
      >
        {tileInner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="text-left active:opacity-90"
      aria-label={`${service.displayLabel}, open service`}
      onClick={() => onPress(service)}
    >
      {tileInner}
    </button>
  );
}

/** 2-column large service card for "Services for You". */
export const ServiceCardLarge = memo(ServiceCardLargeComponent);
