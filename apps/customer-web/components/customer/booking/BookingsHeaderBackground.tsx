'use client';

import { Bone, Footprints, Heart, PawPrint, Sparkles } from 'lucide-react';

/** Dark orange strokes so decor reads on the premium hero gradient (not washed out). */
const STROKE = 'fill-none stroke-[#B84A12]';

const ICON_PRIMARY = `${STROKE} opacity-[0.15]`;
const ICON_SECONDARY = `${STROKE} opacity-10`;
const ICON_TINY = `${STROKE} opacity-20`;

/** Premium My Bookings hero — large, visible pet-themed background art. */
export function BookingsHeaderBackground() {
  return (
    <>
      {/* Dashed walking path connecting decor */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path
          d="M 24 72 Q 95 110 155 88 T 280 95 Q 330 118 380 78"
          fill="none"
          stroke="#B84A12"
          strokeWidth="2"
          strokeDasharray="7 9"
          strokeLinecap="round"
        />
        <path
          d="M 60 200 Q 140 165 220 188 T 360 168"
          fill="none"
          stroke="#B84A12"
          strokeWidth="1.5"
          strokeDasharray="5 8"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>

      {/* Large faded paw — right */}
      <PawPrint
        className={`bookings-deco-float-slow absolute -right-4 bottom-6 h-[140px] w-[140px] rotate-[18deg] sm:h-[168px] sm:w-[168px] ${ICON_PRIMARY}`}
        strokeWidth={1.15}
        aria-hidden
      />

      {/* Heart + paw cluster — center */}
      <div
        className={`pointer-events-none absolute left-[34%] top-[14%] opacity-[0.15] sm:left-[36%]`}
        aria-hidden
      >
        <Heart className={`h-[112px] w-[112px] rotate-[-8deg] sm:h-[128px] sm:w-[128px] ${STROKE}`} strokeWidth={1.1} />
        <PawPrint
          className={`absolute left-1/2 top-[52%] h-9 w-9 -translate-x-1/2 -translate-y-1/2 sm:h-10 sm:w-10 ${STROKE}`}
          strokeWidth={1.35}
        />
      </div>

      {/* Bone — top right */}
      <Bone
        className={`absolute right-[6%] top-[10%] h-[96px] w-[96px] rotate-[24deg] sm:h-[112px] sm:w-[112px] ${ICON_PRIMARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      {/* Secondary paws & footprints */}
      <PawPrint
        className={`bookings-deco-float absolute -left-2 top-8 h-[88px] w-[88px] rotate-[28deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />
      <PawPrint
        className={`absolute left-[18%] bottom-4 h-[72px] w-[72px] -rotate-[16deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />
      <Footprints
        className={`absolute left-[48%] bottom-10 h-14 w-14 rotate-[6deg] ${ICON_SECONDARY}`}
        strokeWidth={1.15}
        aria-hidden
      />
      <Footprints
        className={`absolute right-[28%] top-[42%] h-12 w-12 -rotate-12 ${ICON_SECONDARY}`}
        strokeWidth={1.15}
        aria-hidden
      />

      <Bone
        className={`absolute left-[4%] top-[38%] h-[72px] w-[72px] -rotate-[38deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <Heart
        className={`absolute right-[32%] bottom-8 h-16 w-16 -rotate-12 ${ICON_SECONDARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      {/* Tiny sparkles & dots */}
      <Sparkles
        className={`bookings-deco-float absolute left-[28%] top-[22%] h-8 w-8 rotate-12 ${ICON_TINY}`}
        style={{ animationDelay: '0.4s' }}
        strokeWidth={1.75}
        aria-hidden
      />
      <Sparkles
        className={`absolute right-[20%] top-[32%] h-7 w-7 -rotate-[10deg] ${ICON_TINY}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <Sparkles
        className={`absolute left-[58%] bottom-[38%] h-6 w-6 ${ICON_TINY}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <PawPrint
        className={`absolute left-[62%] top-[6%] h-9 w-9 rotate-[14deg] ${ICON_TINY}`}
        strokeWidth={1.35}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[14%] top-[52%] h-2.5 w-2.5 rounded-full bg-[#B84A12]/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[14%] top-[58%] h-3 w-3 rounded-full border border-[#B84A12]/25"
        aria-hidden
      />
    </>
  );
}

/** Exact premium hero gradient for My Bookings header surface + glow layers. */
export const PREMIUM_BOOKINGS_HEADER_GRADIENT =
  'linear-gradient(135deg, #FF6B1A 0%, #FF7F2A 35%, #FF8E42 70%, #FFA45D 100%)';
