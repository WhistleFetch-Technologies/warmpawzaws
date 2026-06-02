'use client';

import { Bone, Heart, PawPrint } from 'lucide-react';

/** Faded decor — 8% opacity, 1.5px stroke, away from avatar and text. */
const STROKE = 1.5;
const DECO = 'fill-none stroke-white opacity-[0.08]';

export function ProfileHeaderBackground() {
  return (
    <>
      {/* Top center */}
      <PawPrint
        className={`absolute left-1/2 top-[5%] h-[72px] w-[72px] -translate-x-1/2 ${DECO}`}
        strokeWidth={STROKE}
        aria-hidden
      />

      {/* Top right */}
      <PawPrint
        className={`absolute right-[12%] top-[8%] h-14 w-14 rotate-[8deg] ${DECO}`}
        strokeWidth={STROKE}
        aria-hidden
      />

      {/* Right side — bone */}
      <Bone
        className={`absolute right-[5%] top-[36%] h-16 w-16 rotate-[22deg] ${DECO}`}
        strokeWidth={STROKE}
        aria-hidden
      />

      {/* Upper right — heart with paw (clear of name column) */}
      <div
        className="pointer-events-none absolute right-[8%] top-[18%] opacity-[0.08]"
        aria-hidden
      >
        <Heart className="h-14 w-14 stroke-white fill-none" strokeWidth={STROKE} />
        <PawPrint
          className="absolute left-1/2 top-[58%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 stroke-white fill-none"
          strokeWidth={STROKE}
        />
      </div>

      {/* Bottom — walking path */}
      <svg
        className="pointer-events-none absolute bottom-[6%] left-[10%] h-10 w-[80%] opacity-[0.08]"
        viewBox="0 0 320 40"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 28 C 60 8, 120 32, 180 18 S 280 12, 316 24"
          stroke="white"
          strokeWidth={STROKE}
          strokeDasharray="6 8"
          strokeLinecap="round"
        />
        <circle cx="4" cy="28" r="2.5" fill="white" />
        <circle cx="316" cy="24" r="2.5" fill="white" />
      </svg>
    </>
  );
}

export const PROFILE_HEADER_GRADIENT =
  'linear-gradient(135deg, #FF6F2C 0%, #FF8445 50%, #FF965A 100%)';

export const PROFILE_HEADER_RADIAL_LIGHT = `
  radial-gradient(ellipse 75% 55% at 82% 18%, rgba(255, 255, 255, 0.18) 0%, transparent 58%),
  radial-gradient(ellipse 55% 45% at 12% 88%, rgba(255, 210, 170, 0.22) 0%, transparent 52%),
  radial-gradient(ellipse 40% 35% at 50% 45%, rgba(255, 255, 255, 0.06) 0%, transparent 70%)
`;
