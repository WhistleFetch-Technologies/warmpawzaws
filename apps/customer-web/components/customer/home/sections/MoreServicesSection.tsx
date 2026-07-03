'use client';

import React, { memo, useMemo } from 'react';
import Image from 'next/image';
import { Users, Shield, Dog, Coffee, ChevronRight, PawPrint, Heart, MapPin, Sparkles } from 'lucide-react';
import { isAppReviewDemoAccount, readStoredCustomerPhone } from '@/lib/app-review-demo-account';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const MORE_SERVICES_IMAGES = {
  peer: '/images/home/more services/peer.webp',
  insurance: '/images/home/more services/insurance.webp',
  walker: '/images/home/more services/walker.webp',
  cafe: '/images/home/more services/cafe.webp',
} as const;

const MORE_SERVICES_CARDS = [
  {
    id: 'peer',
    title: 'Peer to Peer',
    description: 'Find the perfect match for your pet',
    imageUrl: MORE_SERVICES_IMAGES.peer,
    imageAlt: 'Cat and dog together',
    Icon: Users,
    cardClass: 'from-rose-50/95 to-pink-50/95 border-rose-100/80',
    iconBgClass: 'bg-rose-500',
    ctaClass: 'text-rose-500',
    watermarkClass: 'text-rose-300/35',
    SecondaryIcon: Heart,
    secondaryWatermarkClass: 'text-pink-200/30',
    comingSoon: true,
  },
  {
    id: 'insurance',
    title: 'Pet Insurance',
    description: 'Protect your furry friend & enjoy peace of mind',
    imageUrl: MORE_SERVICES_IMAGES.insurance,
    imageAlt: 'Pet insurance shield and documents',
    Icon: Shield,
    cardClass: 'from-sky-50/95 to-blue-50/95 border-cyan-100/80',
    iconBgClass: 'bg-sky-500',
    ctaClass: 'text-sky-600',
    watermarkClass: 'text-sky-300/35',
    SecondaryIcon: PawPrint,
    secondaryWatermarkClass: 'text-cyan-200/30',
    comingSoon: true,
  },
  {
    id: 'walker',
    title: 'Dog Walkers',
    description: 'Trusted & verified walkers near you',
    imageUrl: MORE_SERVICES_IMAGES.walker,
    imageAlt: 'Golden retriever with a leash',
    Icon: Dog,
    cardClass: 'from-green-50 to-emerald-50/95 border-green-100',
    iconBgClass: 'bg-emerald-500',
    ctaClass: 'text-emerald-600',
    watermarkClass: 'text-emerald-300/35',
    SecondaryIcon: MapPin,
    secondaryWatermarkClass: 'text-green-200/30',
    ctaLabel: 'Book Now',
    comingSoon: false,
    screen: 'walker' as const,
  },
  {
    id: 'cafe',
    title: 'Pet Cafes',
    description: 'Pet-friendly dining spots to enjoy together',
    imageUrl: MORE_SERVICES_IMAGES.cafe,
    imageAlt: 'Pet-friendly cafe storefront',
    Icon: Coffee,
    cardClass: 'from-amber-50/95 to-orange-50/95 border-amber-100/80',
    iconBgClass: 'bg-amber-500',
    ctaClass: 'text-amber-600',
    watermarkClass: 'text-amber-300/35',
    SecondaryIcon: Sparkles,
    secondaryWatermarkClass: 'text-orange-200/30',
    comingSoon: true,
  },
] as const;

export interface MoreServicesSectionProps {
  onNavigate: HomeNavigateFn;
  className?: string;
  /** When true, under-build cards are removed entirely (not shown as Soon). */
  reviewDemoAccount?: boolean;
}

function MoreServiceCard({
  card,
  onNavigate,
}: {
  card: (typeof MORE_SERVICES_CARDS)[number];
  onNavigate: HomeNavigateFn;
}) {
  const ctaLabel = 'ctaLabel' in card ? card.ctaLabel : 'Coming soon';

  const content = (
    <>
      <card.Icon
        className={`pointer-events-none absolute -right-3 bottom-6 h-[5.5rem] w-[5.5rem] ${card.watermarkClass}`}
        strokeWidth={1.25}
        aria-hidden
      />
      <card.SecondaryIcon
        className={`pointer-events-none absolute left-[38%] top-3 h-10 w-10 ${card.secondaryWatermarkClass}`}
        strokeWidth={1.5}
        aria-hidden
      />

      {card.comingSoon ? (
        <span className="absolute right-3 top-3 rounded-full bg-[#FF8C00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Soon
        </span>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-3.5 pr-2">
        <div
          className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full shadow-sm ${card.iconBgClass}`}
          aria-hidden
        >
          <card.Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.25} />
        </div>

        <h3 className="mb-0.5 text-[13px] font-bold leading-tight text-[#1E2A4A]">{card.title}</h3>
        <p className="mb-3 text-[11px] leading-snug text-gray-500">{card.description}</p>

        <span
          className={`mt-auto inline-flex w-fit items-center gap-0.5 text-[11px] font-semibold ${card.ctaClass}`}
        >
          {ctaLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>

      <div className="relative flex w-[5.5rem] shrink-0 flex-col justify-end sm:w-[6.25rem]">
        <div className="relative h-[5rem] w-full sm:h-[5.5rem]">
          <Image
            src={card.imageUrl}
            alt={card.imageAlt}
            fill
            className="object-contain object-bottom drop-shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
            sizes="(max-width: 640px) 88px, 100px"
            unoptimized
          />
        </div>
      </div>
    </>
  );

  const cardClassName = `relative flex min-h-[9.5rem] overflow-hidden rounded-2xl border bg-gradient-to-br text-left shadow-[0_4px_20px_rgba(15,23,42,0.06)] ${card.cardClass}`;

  if (card.comingSoon) {
    return (
      <div
        className={`${cardClassName} pointer-events-none select-none`}
        aria-label={`${card.title} — coming soon`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate('screen' in card ? card.screen : card.id)}
      className={`${cardClassName} w-full transition-shadow hover:shadow-md`}
    >
      {content}
    </button>
  );
}

function MoreServicesSectionComponent({
  onNavigate,
  className = '',
  reviewDemoAccount: reviewDemoAccountProp,
}: MoreServicesSectionProps) {
  const reviewDemoAccount =
    reviewDemoAccountProp ?? isAppReviewDemoAccount(readStoredCustomerPhone());
  const visibleCards = useMemo(
    () =>
      reviewDemoAccount
        ? MORE_SERVICES_CARDS.filter((card) => !card.comingSoon)
        : MORE_SERVICES_CARDS,
    [reviewDemoAccount]
  );

  if (visibleCards.length === 0) return null;

  return (
    <div className={`mb-6 px-4 ${className}`} aria-label="More Services">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400">
          <PawPrint className="h-4 w-4 text-white" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-[#1E2A4A]">More Services</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            More ways to care, connect and pamper your pet.
          </p>
        </div>
      </div>

      {/* Single column on mobile — 2-up grid squeezes text and images on narrow viewports */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleCards.map((card) => (
          <MoreServiceCard key={card.id} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export const MoreServicesSection = memo(MoreServicesSectionComponent);
