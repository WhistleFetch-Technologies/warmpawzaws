'use client';

import React, { memo } from 'react';
import { Home, PawPrint, BadgeCheck } from 'lucide-react';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { HOME_VISIT_HERO_IMAGE } from './constants/home-visit-service-catalog';

const PAW_CLASS =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none [&>line]:fill-none text-white/20';

function HomeVisitPawBackground() {
  return (
    <>
      <PawPrint className={`absolute -left-1 top-3 h-8 w-8 -rotate-[18deg] ${PAW_CLASS}`} strokeWidth={1} />
      <PawPrint className={`absolute left-[18%] top-10 h-6 w-6 rotate-12 ${PAW_CLASS}`} strokeWidth={1} />
      <PawPrint className={`absolute right-[12%] top-6 h-9 w-9 rotate-[24deg] ${PAW_CLASS}`} strokeWidth={1} />
      <PawPrint className={`absolute right-2 bottom-16 h-7 w-7 -rotate-[30deg] ${PAW_CLASS}`} strokeWidth={1} />
      <PawPrint className={`absolute left-[40%] bottom-10 h-5 w-5 rotate-[-12deg] ${PAW_CLASS}`} strokeWidth={1} />
    </>
  );
}

export interface HomeVisitHeroProps {
  onBack: () => void;
}

function HomeVisitHeroComponent({ onBack }: HomeVisitHeroProps) {
  return (
    <div className="relative">
      <ServiceDashboardHeader
        serviceName="Home Visit"
        serviceSubtitle="Professional pet care at your doorstep"
        serviceIcon={Home}
        hideServiceIcon
        onBack={onBack}
        showBackButton
        bottomEdge="sheet"
        sheetToneClass="bg-white"
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        headerBackground={<HomeVisitPawBackground />}
        headerTrailingImage={HOME_VISIT_HERO_IMAGE}
        headerTrailingImageAlt="Happy golden retriever with medical kit"
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.5rem] z-[5] flex w-[38%] max-w-[150px] items-end justify-end pr-1"
        headerTrailingImageImgClassName="home-visit-hero-float h-auto max-h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
      />

      <span className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-30 inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
        <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        Verified
      </span>

      <style jsx global>{`
        @keyframes home-visit-hero-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .home-visit-hero-float {
          animation: home-visit-hero-float 4.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-visit-hero-float {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export const HomeVisitHero = memo(HomeVisitHeroComponent);
