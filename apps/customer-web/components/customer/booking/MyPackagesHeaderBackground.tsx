'use client';

import { Box, Heart, Package2, PawPrint, ShieldCheck, Sparkles } from 'lucide-react';

/** Warm stroke so decor reads on the orange header gradient (matches Bookings hero). */
const STROKE = 'fill-none stroke-[#B84A12]';

const ICON_PRIMARY = `${STROKE} opacity-[0.14]`;
const ICON_SECONDARY = `${STROKE} opacity-[0.09]`;
const ICON_TINY = `${STROKE} opacity-[0.18]`;

/** Faded package + pet-care icons behind My Packages header content. */
export function MyPackagesHeaderBackground() {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.1]"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path
          d="M 32 64 Q 120 92 200 70 T 360 82"
          fill="none"
          stroke="#B84A12"
          strokeWidth="1.75"
          strokeDasharray="6 10"
          strokeLinecap="round"
        />
        <path
          d="M 48 178 Q 160 150 260 172 T 372 158"
          fill="none"
          stroke="#B84A12"
          strokeWidth="1.25"
          strokeDasharray="5 8"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>

      <Package2
        className={`bookings-deco-float-slow absolute -right-2 bottom-4 h-[128px] w-[128px] rotate-[12deg] sm:h-[152px] sm:w-[152px] ${ICON_PRIMARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      <Box
        className={`absolute right-[10%] top-[8%] h-[88px] w-[88px] rotate-[20deg] sm:h-[100px] sm:w-[100px] ${ICON_SECONDARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute left-[38%] top-[12%] opacity-[0.12] sm:left-[40%]"
        aria-hidden
      >
        <Heart className={`h-[96px] w-[96px] rotate-[-6deg] sm:h-[108px] sm:w-[108px] ${STROKE}`} strokeWidth={1.1} />
        <PawPrint
          className={`absolute left-1/2 top-[54%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 sm:h-9 sm:w-9 ${STROKE}`}
          strokeWidth={1.3}
        />
      </div>

      <ShieldCheck
        className={`bookings-deco-float absolute right-[22%] top-[38%] h-16 w-16 -rotate-6 sm:h-[72px] sm:w-[72px] ${ICON_SECONDARY}`}
        strokeWidth={1.15}
        aria-hidden
      />

      <PawPrint
        className={`absolute -left-1 top-10 h-[76px] w-[76px] rotate-[22deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />
      <PawPrint
        className={`absolute left-[20%] bottom-6 h-[64px] w-[64px] -rotate-[14deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <Package2
        className={`absolute left-[6%] top-[42%] h-[56px] w-[56px] -rotate-[28deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <Sparkles
        className={`bookings-deco-float absolute left-[30%] top-[20%] h-7 w-7 rotate-12 ${ICON_TINY}`}
        style={{ animationDelay: '0.35s' }}
        strokeWidth={1.75}
        aria-hidden
      />
      <Sparkles
        className={`absolute right-[16%] top-[26%] h-6 w-6 -rotate-[8deg] ${ICON_TINY}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <PawPrint
        className={`absolute left-[58%] top-[4%] h-8 w-8 rotate-[10deg] ${ICON_TINY}`}
        strokeWidth={1.35}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[12%] bottom-[28%] h-2.5 w-2.5 rounded-full bg-[#B84A12]/18"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[12%] top-[58%] h-3 w-3 rounded-full border border-[#B84A12]/22"
        aria-hidden
      />
    </>
  );
}
