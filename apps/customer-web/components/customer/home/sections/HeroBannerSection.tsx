'use client';

import React, { memo } from 'react';
import { BannerCarousel } from '../shared/BannerCarousel';
import type { HomeCarouselBanner } from '../types';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface HeroBannerSectionProps {
  banners: HomeCarouselBanner[];
  onNavigate: HomeNavigateFn;
  className?: string;
}

function HeroBannerSectionComponent({ banners, onNavigate, className = '' }: HeroBannerSectionProps) {
  return (
    <BannerCarousel
      banners={banners}
      onNavigate={onNavigate}
      trackingSource="home_carousel"
      className={className}
    />
  );
}

/** Hero promo carousel — CMS home_top banners with CTA navigation. */
export const HeroBannerSection = memo(HeroBannerSectionComponent);
