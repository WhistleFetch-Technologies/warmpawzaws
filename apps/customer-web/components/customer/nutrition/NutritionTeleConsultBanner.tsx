'use client';

import { CachedImage } from '@/components/shared/CachedImage';
import {
  Video,
  Zap,
  ChevronRight,
  ShieldCheck,
  Lock,
  Clock,
  PawPrint,
} from 'lucide-react';

const BANNER_IMAGE = '/images/home/Nutrition/banner-img.webp';

const FEATURE_PILLS = [
  { Icon: ShieldCheck, label: 'Expert Nutritionists' },
  { Icon: Lock, label: 'Safe & Private' },
  { Icon: Clock, label: 'Quick & Easy' },
] as const;

const FLOATING_PAWS = [
  { wrapperClass: 'right-[38%] top-3', iconClass: 'h-7 w-7 text-emerald-300/45', driftClass: 'nutrition-banner-drift-1' },
  { wrapperClass: 'right-6 top-1/2 -translate-y-1/2', iconClass: 'h-9 w-9 text-green-300/35', driftClass: 'nutrition-banner-drift-2' },
  { wrapperClass: 'right-[28%] bottom-8', iconClass: 'h-6 w-6 text-emerald-200/50', driftClass: 'nutrition-banner-drift-3' },
] as const;

export interface NutritionTeleConsultBannerProps {
  onClick: () => void;
  className?: string;
}

export function NutritionTeleConsultBanner({ onClick, className = '' }: NutritionTeleConsultBannerProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Video consultation with pet nutritionists — instant available from ₹300"
        className="nutrition-banner-enter group relative w-full overflow-hidden rounded-2xl border-2 border-green-200/90 bg-gradient-to-br from-[#E8F9EE] via-emerald-50/90 to-[#F0FDF4] text-left shadow-[0_6px_24px_rgba(34,197,94,0.1)] transition-shadow hover:shadow-[0_10px_32px_rgba(34,197,94,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
      >
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {FLOATING_PAWS.map(({ wrapperClass, iconClass, driftClass }, index) => (
            <span key={index} className={`absolute ${wrapperClass}`}>
              <PawPrint
                className={`nutrition-banner-bg-drift ${driftClass} ${iconClass}`}
                strokeWidth={1.5}
              />
            </span>
          ))}
          <span className="nutrition-banner-circle-breathe absolute left-[42%] top-6 h-16 w-16 rounded-full bg-emerald-200/20" />
          <span className="nutrition-banner-circle-breathe nutrition-banner-circle-delay absolute right-[32%] bottom-10 h-10 w-10 rounded-full bg-green-200/25" />
          <span className="nutrition-banner-circle-breathe nutrition-banner-circle-delay-2 absolute left-1/4 bottom-6 h-6 w-6 rounded-full bg-emerald-300/20" />
        </div>

        <div className="relative z-10 flex min-h-[156px]">
          {/* Left content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 pr-1 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="nutrition-banner-icon-pulse flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500 shadow-[0_4px_12px_rgba(34,197,94,0.35)]">
                <Video className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-base font-bold leading-tight text-[#1A202C] sm:text-[17px]">
                  Video Consultation
                </h3>
                <span className="nutrition-banner-badge-pulse mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:text-[11px]">
                  <Zap className="h-3 w-3 fill-white" aria-hidden />
                  Instant Available
                </span>
              </div>
            </div>

            <p className="text-xs leading-snug text-[#4A5568] sm:text-sm">
              Connect with pet nutritionists via video call.
              <span className="mt-0.5 block font-medium text-[#374151]">From ₹300</span>
            </p>

            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {FEATURE_PILLS.map(({ Icon, label }, index) => (
                <span
                  key={label}
                  className={`nutrition-banner-feature-item nutrition-banner-feature-${index + 1} inline-flex items-center gap-1 rounded-full border border-green-100/80 bg-white/90 px-2 py-1 text-[9px] font-medium text-[#374151] shadow-sm backdrop-blur-sm sm:text-[10px]`}
                >
                  <Icon className="h-3 w-3 shrink-0 text-green-500" strokeWidth={2.25} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — mascot */}
          <div className="relative flex w-[38%] max-w-[148px] shrink-0 items-center justify-center py-3 pr-1 sm:w-[40%] sm:max-w-[160px]">
            <div className="nutrition-banner-img-float relative aspect-[4/5] w-[88%] max-h-[118px] sm:max-h-[126px]">
              <div
                className="nutrition-banner-img-glow pointer-events-none absolute inset-[10%] rounded-[1.75rem] bg-gradient-to-b from-white/60 via-emerald-50/40 to-white/30"
                aria-hidden
              />
              <CachedImage
                src={BANNER_IMAGE}
                alt="Pet doctor video consultation on laptop"
                fill
                className="relative z-[1] object-contain object-center drop-shadow-[0_8px_20px_rgba(34,197,94,0.18)]"
                sizes="160px"
                loading="eager"
              />
            </div>
          </div>
        </div>

        <ChevronRight
          className="absolute right-3 top-3 z-20 h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>

      <style jsx>{`
        @keyframes nutrition-banner-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes nutrition-banner-float {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-5px) scale(1.015);
          }
        }
        @keyframes nutrition-banner-bg-drift {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(2px, -3px) rotate(4deg);
          }
        }
        @keyframes nutrition-banner-circle-breathe {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.08);
          }
        }
        @keyframes nutrition-banner-icon-pulse {
          0%,
          100% {
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
          }
          50% {
            box-shadow: 0 4px 18px rgba(34, 197, 94, 0.52);
          }
        }
        @keyframes nutrition-banner-badge-pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 1px 4px rgba(34, 197, 94, 0.25);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 2px 8px rgba(34, 197, 94, 0.38);
          }
        }
        @keyframes nutrition-banner-img-glow {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.06);
          }
        }
        @keyframes nutrition-banner-feature-rise {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .nutrition-banner-enter {
          animation: nutrition-banner-enter 0.5s ease-out both;
        }
        .nutrition-banner-img-float {
          animation: nutrition-banner-float 4s ease-in-out infinite;
        }
        .nutrition-banner-img-glow {
          animation: nutrition-banner-img-glow 3.5s ease-in-out infinite;
        }
        .nutrition-banner-bg-drift {
          animation: nutrition-banner-bg-drift 6.5s ease-in-out infinite;
        }
        .nutrition-banner-drift-1 {
          animation-delay: 0s;
        }
        .nutrition-banner-drift-2 {
          animation-delay: -2.2s;
        }
        .nutrition-banner-drift-3 {
          animation-delay: -4.4s;
        }
        .nutrition-banner-circle-breathe {
          animation: nutrition-banner-circle-breathe 5s ease-in-out infinite;
        }
        .nutrition-banner-circle-delay {
          animation-delay: -1.6s;
        }
        .nutrition-banner-circle-delay-2 {
          animation-delay: -3.2s;
        }
        .nutrition-banner-icon-pulse {
          animation: nutrition-banner-icon-pulse 2.8s ease-in-out infinite;
        }
        .nutrition-banner-badge-pulse {
          animation: nutrition-banner-badge-pulse 2.4s ease-in-out infinite;
        }
        .nutrition-banner-feature-item {
          animation: nutrition-banner-feature-rise 0.45s ease-out both;
        }
        .nutrition-banner-feature-1 {
          animation-delay: 0.2s;
        }
        .nutrition-banner-feature-2 {
          animation-delay: 0.32s;
        }
        .nutrition-banner-feature-3 {
          animation-delay: 0.44s;
        }

        @media (prefers-reduced-motion: reduce) {
          .nutrition-banner-enter,
          .nutrition-banner-img-float,
          .nutrition-banner-img-glow,
          .nutrition-banner-bg-drift,
          .nutrition-banner-circle-breathe,
          .nutrition-banner-icon-pulse,
          .nutrition-banner-badge-pulse,
          .nutrition-banner-feature-item {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
