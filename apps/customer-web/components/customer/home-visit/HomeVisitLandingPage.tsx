'use client';

import React, { memo, useCallback } from 'react';
import { HomeVisitHero } from './HomeVisitHero';
import { HomeVisitQuickStats } from './HomeVisitQuickStats';
import { HomeVisitServiceGrid } from './HomeVisitServiceGrid';
import { HomeVisitTimeline } from './HomeVisitTimeline';
import { HomeVisitTrustSection } from './HomeVisitTrustSection';
import { HomeVisitPopularServices } from './HomeVisitPopularServices';
import { HomeVisitBottomCTA } from './HomeVisitBottomCTA';
import type { HomeVisitNavigateFn } from './constants/home-visit-service-catalog';

export interface HomeVisitLandingPageProps {
  onBack: () => void;
  onNavigate?: HomeVisitNavigateFn;
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

function HomeVisitLandingPageComponent({ onBack, onNavigate }: HomeVisitLandingPageProps) {
  const navigate = useCallback<HomeVisitNavigateFn>(
    (screen, data) => {
      onNavigate?.(screen, { ...(data ?? {}), fromHomeVisitLanding: true });
    },
    [onNavigate]
  );

  return (
    <div className="relative min-h-screen bg-gray-50">
      <HomeVisitHero onBack={onBack} />
      <HomeVisitQuickStats />
      <HomeVisitServiceGrid onNavigate={navigate} />
      <HomeVisitTimeline />
      <HomeVisitTrustSection />
      <HomeVisitPopularServices onNavigate={navigate} />
      <div className="h-28" aria-hidden />
      <HomeVisitBottomCTA onNavigate={navigate} />
      <style jsx global>{`
        @keyframes home-visit-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .home-visit-fade-in {
          animation: home-visit-fade-in 0.45s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-visit-fade-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export const HomeVisitLandingPage = memo(HomeVisitLandingPageComponent);
