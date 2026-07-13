'use client';

import React, { memo, useCallback } from 'react';
import { PremiumServiceCard } from '../shared/PremiumServiceCard';
import { usePremiumServiceCards } from '../hooks/usePremiumServiceCards';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface PremiumServiceCardsSectionProps {
  phone?: string;
  customerCommerceEnabled: boolean;
  onNavigate: HomeNavigateFn;
  className?: string;
  reviewDemoAccount?: boolean;
}

function PremiumServiceCardsSectionComponent({
  phone,
  customerCommerceEnabled,
  onNavigate,
  className = '',
  reviewDemoAccount = false,
}: PremiumServiceCardsSectionProps) {
  const { cards } = usePremiumServiceCards(phone, customerCommerceEnabled, reviewDemoAccount);

  const handlePress = useCallback(
    (screen: string, navigateData?: Record<string, unknown>) => {
      onNavigate(screen, navigateData);
    },
    [onNavigate]
  );

  if (cards.length === 0) return null;

  const gridColsClass =
    cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <section className={`mb-3 px-4 ${className}`} aria-label="Quick service actions">
      <div className={`grid ${gridColsClass} gap-2 sm:gap-2.5`}>
        {cards.map((entry, index) => (
          <PremiumServiceCard
            key={entry.id}
            entry={entry}
            index={index}
            onPress={() => handlePress(entry.screen, entry.navigateData)}
          />
        ))}
      </div>
      <style jsx global>{`
        @keyframes premium-service-card-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes premium-watermark-float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.09;
          }
          50% {
            transform: translateY(-3px) rotate(2deg);
            opacity: 0.12;
          }
        }
        @keyframes premium-watermark-drift {
          0%,
          100% {
            transform: translate(0, 0) rotate(-18deg);
            opacity: 0.08;
          }
          50% {
            transform: translate(2px, -2px) rotate(-14deg);
            opacity: 0.1;
          }
        }
        @keyframes premium-watermark-pulse {
          0%,
          100% {
            transform: rotate(14deg) scale(1);
            opacity: 0.06;
          }
          50% {
            transform: rotate(10deg) scale(1.06);
            opacity: 0.09;
          }
        }
        .premium-service-card-enter {
          animation: premium-service-card-fade-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .premium-watermark-float {
          animation: premium-watermark-float 5.5s ease-in-out infinite;
        }
        .premium-watermark-drift {
          animation: premium-watermark-drift 6.5s ease-in-out infinite;
        }
        .premium-watermark-pulse {
          animation: premium-watermark-pulse 4.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .premium-watermark-float,
          .premium-watermark-drift,
          .premium-watermark-pulse {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

/** Three premium quick-action cards below the home search bar. */
export const PremiumServiceCardsSection = memo(PremiumServiceCardsSectionComponent);
