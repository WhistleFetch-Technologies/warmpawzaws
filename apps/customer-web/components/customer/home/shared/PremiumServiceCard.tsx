'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { ChevronRight, PawPrint } from 'lucide-react';
import type { PremiumServiceCardEntry } from '../constants/premium-service-cards-catalog';

/**
 * Every card image renders at this exact height (base / sm breakpoint), sized
 * to fill most of the card's vertical space so the pet cutout reads as the
 * primary visual, not an afterthought. Kept as one shared constant so all
 * three premium cards stay perfectly consistent.
 */
const CARD_IMAGE_HEIGHT_CLASS = 'h-[120px] sm:h-[134px]';
const CARD_IMAGE_INTRINSIC_WIDTH = 240;
const CARD_IMAGE_INTRINSIC_HEIGHT = 134;

export interface PremiumServiceCardProps {
  entry: PremiumServiceCardEntry;
  index: number;
  onPress: () => void;
}

function PremiumServiceCardComponent({ entry, index, onPress }: PremiumServiceCardProps) {
  const { theme } = entry;
  const BadgeIcon = theme.badgeIcon;
  const WatermarkIcon = theme.watermarkIcon;

  return (
    <button
      type="button"
      onClick={onPress}
      className={`premium-service-card-enter group relative flex min-h-[10.25rem] min-w-0 items-stretch overflow-hidden rounded-[26px] border bg-gradient-to-br text-left transition-[transform,box-shadow] duration-300 ease-out active:scale-[0.97] hover:-translate-y-1 hover:scale-[1.02] ${theme.gradientFrom} ${theme.gradientTo} ${theme.hoverGradientFrom} ${theme.hoverGradientTo} ${theme.borderClass} ${theme.shadowClass} ${theme.hoverShadowClass}`}
      style={{ animationDelay: `${index * 70}ms` }}
      aria-label={`${entry.titleLines.join(' ')} — ${entry.subtitle}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-500 ease-out ${theme.glowClass}`}
        aria-hidden
      />

      <WatermarkIcon
        className={`premium-watermark-float pointer-events-none absolute -right-2 top-7 h-[3.75rem] w-[3.75rem] opacity-[0.09] ${theme.watermarkClass}`}
        strokeWidth={1.25}
        style={{ animationDelay: `${index * 0.4}s` }}
        aria-hidden
      />
      <PawPrint
        className={`premium-watermark-drift pointer-events-none absolute bottom-9 left-0.5 h-9 w-9 -rotate-[18deg] opacity-[0.08] ${theme.watermarkClass}`}
        strokeWidth={1.25}
        style={{ animationDelay: `${index * 0.55}s` }}
        aria-hidden
      />
      <PawPrint
        className={`premium-watermark-pulse pointer-events-none absolute right-[38%] top-[42%] h-6 w-6 rotate-[14deg] opacity-[0.06] ${theme.watermarkClass}`}
        strokeWidth={1.25}
        style={{ animationDelay: `${index * 0.7}s` }}
        aria-hidden
      />

      <div className="relative z-10 flex min-w-0 flex-[1.15] flex-col px-2.5 pb-2.5 pt-2.5">
        <span
          className={`mb-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-white/95 shadow-[0_2px_10px_rgba(15,23,42,0.1)] transition-[box-shadow,transform,background-color] duration-300 ease-out group-hover:scale-110 group-hover:bg-white group-hover:shadow-[0_4px_16px_rgba(15,23,42,0.16)] ${theme.badgeBorderClass}`}
          aria-hidden
        >
          <BadgeIcon
            className={`h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:scale-105 ${theme.badgeIconClass}`}
            strokeWidth={1.85}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h3
            className={`text-[10px] font-extrabold uppercase leading-[1.08] tracking-[0.02em] transition-[letter-spacing] duration-300 ease-out group-hover:tracking-[0.04em] sm:text-[11px] ${theme.titleClass}`}
          >
            {entry.titleLines[0]}
            <br />
            {entry.titleLines[1]}
          </h3>
          <p className={`mt-0.5 text-[8.5px] leading-snug sm:text-[9px] ${theme.subtitleClass}`}>
            {entry.subtitle}
          </p>
        </div>

        <span
          className={`mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-[transform,background-color,box-shadow] duration-300 ease-out group-hover:translate-x-1 group-hover:scale-110 group-hover:shadow-md ${theme.ctaBgClass} ${theme.ctaHoverClass}`}
          aria-hidden
        >
          <ChevronRight className="h-3 w-3" strokeWidth={2.75} />
        </span>
      </div>

      {/* Hero image: fixed equal height across all cards, bottom-right aligned with breathing room */}
      <div className="relative z-10 w-[43%] shrink-0 self-stretch overflow-hidden sm:w-[40%]">
        <div className="absolute inset-0 flex items-end justify-end pb-1.5 pr-1">
          <Image
            src={entry.imageUrl}
            alt={entry.imageAlt}
            width={CARD_IMAGE_INTRINSIC_WIDTH}
            height={CARD_IMAGE_INTRINSIC_HEIGHT}
            className={`block w-auto object-contain object-bottom drop-shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition-[transform,filter] duration-500 ease-out group-hover:translate-x-0.5 group-hover:scale-[1.03] group-hover:brightness-[1.03] ${CARD_IMAGE_HEIGHT_CLASS}`}
            style={{
              marginRight: `${entry.imageNudgeX ?? 0}px`,
              marginBottom: `${entry.imageNudgeY ?? 0}px`,
            }}
            priority={index === 0}
            unoptimized
          />
        </div>
      </div>
    </button>
  );
}

/** Premium home quick-action card — themed gradient tile with hero cutout image. */
export const PremiumServiceCard = memo(PremiumServiceCardComponent);
