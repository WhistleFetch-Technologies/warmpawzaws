'use client';

import { Box, Package, PawPrint, ShoppingBag, Sparkles } from 'lucide-react';

/** Warm stroke so decor reads on the orange header gradient (matches My Packages / Bookings). */
const STROKE = 'fill-none stroke-[#B84A12]';

const ICON_PRIMARY = `${STROKE} opacity-[0.1]`;
const ICON_SECONDARY = `${STROKE} opacity-[0.08]`;
const ICON_TINY = `${STROKE} opacity-[0.14]`;

/** Faded shopping-themed icons behind My Orders header content. */
export function MyOrdersHeaderBackground() {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path
          d="M 28 58 Q 110 88 195 68 T 368 80"
          fill="none"
          stroke="#B84A12"
          strokeWidth="1.75"
          strokeDasharray="6 10"
          strokeLinecap="round"
        />
        <path
          d="M 44 172 Q 155 148 248 168 T 376 154"
          fill="none"
          stroke="#B84A12"
          strokeWidth="1.25"
          strokeDasharray="5 8"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>

      <ShoppingBag
        className={`bookings-deco-float-slow absolute -right-1 bottom-3 h-[120px] w-[120px] rotate-[10deg] sm:h-[140px] sm:w-[140px] ${ICON_PRIMARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      <Package
        className={`absolute right-[12%] top-[6%] h-[84px] w-[84px] rotate-[18deg] sm:h-[96px] sm:w-[96px] ${ICON_SECONDARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      <Box
        className={`absolute left-[4%] top-[38%] h-[72px] w-[72px] -rotate-[22deg] sm:h-[80px] sm:w-[80px] ${ICON_SECONDARY}`}
        strokeWidth={1.1}
        aria-hidden
      />

      <PawPrint
        className={`absolute left-[36%] top-[10%] h-[88px] w-[88px] rotate-[-8deg] sm:h-[100px] sm:w-[100px] ${ICON_PRIMARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <PawPrint
        className={`absolute -left-1 top-12 h-[68px] w-[68px] rotate-[24deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <PawPrint
        className={`absolute left-[18%] bottom-5 h-[58px] w-[58px] -rotate-[12deg] ${ICON_SECONDARY}`}
        strokeWidth={1}
        aria-hidden
      />

      <Sparkles
        className={`bookings-deco-float absolute left-[28%] top-[22%] h-7 w-7 rotate-12 ${ICON_TINY}`}
        style={{ animationDelay: '0.35s' }}
        strokeWidth={1.75}
        aria-hidden
      />
      <Sparkles
        className={`absolute right-[18%] top-[28%] h-6 w-6 -rotate-[6deg] ${ICON_TINY}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <Sparkles
        className={`absolute left-[56%] bottom-[32%] h-5 w-5 rotate-[14deg] ${ICON_TINY}`}
        strokeWidth={1.75}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute right-[10%] bottom-[26%] h-2.5 w-2.5 rounded-full bg-[#B84A12]/16"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[10%] top-[56%] h-3 w-3 rounded-full border border-[#B84A12]/20"
        aria-hidden
      />
    </>
  );
}
