'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { Heart, Home as HomeIcon, PawPrint, Sparkles } from 'lucide-react';
import { ADOPTION_IMAGE_URLS } from '../constants/adoption-images';

const ADOPTION_CARDS = [
  {
    title: 'Adopt from NGOs',
    description: 'Give a home to rescued pets',
    Icon: Heart,
    iconBg: 'from-[#FF4D6D] to-[#FF6B8A]',
    cardGradient: 'from-[#FFF0F3] via-[#FFEEF2] to-[#FFE4EC]',
    accentRing: 'ring-rose-200/60',
    glowColor: 'rgba(255,77,109,0.18)',
    imageUrl: ADOPTION_IMAGE_URLS.dog,
    imageAlt: 'Golden retriever puppy',
  },
  {
    title: 'Pet Rehoming',
    description: 'Find loving owners',
    Icon: HomeIcon,
    iconBg: 'from-[#FF6B35] to-[#FF8C42]',
    cardGradient: 'from-[#FFF7F0] via-[#FFF2E8] to-[#FFEDE0]',
    accentRing: 'ring-orange-200/60',
    glowColor: 'rgba(255,107,53,0.16)',
    imageUrl: ADOPTION_IMAGE_URLS.cat,
    imageAlt: 'Tabby kitten',
  },
] as const;

function FloatingHeart({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      style={style}
      fill="none"
    >
      <path
        d="M12 20.5c-4.2-3.1-7.5-5.8-7.5-9.2C4.5 8.1 6.6 6 9.2 6c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8 2.6 0 4.7 2.1 4.7 5.3 0 3.4-3.3 6.1-7.5 9.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export interface AdoptionSectionProps {
  adoptablePets?: number | string;
  rehomingListings?: number | string;
  className?: string;
}

function AdoptionSectionComponent({
  adoptablePets = 50,
  rehomingListings = 20,
  className = '',
}: AdoptionSectionProps) {
  const stats = {
    adoptable: `${adoptablePets}+`,
    rehoming: `${rehomingListings}+`,
  };

  return (
    <div className={`mb-6 px-4 ${className}`} aria-label="Adoption — coming soon">
      <div className="adopt-section relative overflow-hidden rounded-[28px] border border-rose-100/90 bg-gradient-to-br from-rose-50 via-[#FFF9F7] to-orange-50 p-4 shadow-[0_10px_40px_rgba(255,77,109,0.1)]">
        {/* Ambient background shapes */}
        <div
          className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-[#FF4D6D]/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-[#FF8C42]/12 blur-2xl"
          aria-hidden
        />
        <FloatingHeart
          className="adopt-heart-float pointer-events-none absolute left-3 top-6 h-3 w-3 text-[#FF4D6D]/35"
          style={{ animationDelay: '0s' }}
        />
        <FloatingHeart
          className="adopt-heart-float pointer-events-none absolute right-[42%] top-3 h-2.5 w-2.5 text-[#FF8C42]/30"
          style={{ animationDelay: '1.2s' }}
        />
        <FloatingHeart
          className="adopt-heart-float pointer-events-none absolute bottom-[38%] left-[18%] h-2 w-2 text-[#FF4D6D]/25"
          style={{ animationDelay: '2.1s' }}
        />
        <PawPrint
          className="pointer-events-none absolute bottom-4 right-[38%] h-5 w-5 rotate-12 text-rose-200/50"
          aria-hidden
        />

        {/* Header */}
        <div className="relative mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-[#FF4D6D] shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              Every paw deserves love
            </div>

            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <div
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4D6D] to-[#FF6B8A] shadow-[0_4px_14px_rgba(255,77,109,0.35)]"
                aria-hidden
              >
                <Heart className="h-4 w-4 fill-white/20 text-white" strokeWidth={2.25} />
                <PawPrint className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-white/90" strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-bold tracking-tight text-gray-900">Adoption</h2>
              <span className="adopt-soon-pulse relative shrink-0 overflow-hidden rounded-full bg-gradient-to-r from-[#FF8C00] to-[#FF6B35] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_2px_8px_rgba(255,140,0,0.4)]">
                Soon
              </span>
            </div>

            <p className="max-w-[14rem] text-xs leading-relaxed text-gray-600">
              Coming soon — adoption and rehoming when we launch. Find your perfect companion then.
            </p>
          </div>

          <div className="relative h-[6rem] w-[7rem] shrink-0">
            <div
              className="absolute inset-x-0 bottom-1 top-3 rounded-[48%] bg-gradient-to-br from-[#FFD6E0] to-[#FFE8EE] shadow-inner"
              aria-hidden
            />
            <div
              className="adopt-hero-float absolute inset-x-2 bottom-0 top-1 z-10"
            >
              <Image
                src={ADOPTION_IMAGE_URLS.dogAndCat}
                alt="Puppy and kitten together"
                fill
                className="object-contain object-bottom drop-shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                sizes="112px"
                unoptimized
                priority={false}
              />
            </div>
            <FloatingHeart
              className="adopt-heart-float pointer-events-none absolute -right-0.5 top-1 z-20 h-3.5 w-3.5 text-[#FF4D6D]/50"
              style={{ animationDelay: '0.6s' }}
            />
          </div>
        </div>

        {/* Teaser stats */}
        <div className="relative mb-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs" aria-hidden>
              🐾
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-gray-900">{stats.adoptable}</p>
              <p className="truncate text-[9px] text-gray-500">pets waiting</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs" aria-hidden>
              🏠
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-gray-900">{stats.rehoming}</p>
              <p className="truncate text-[9px] text-gray-500">rehoming stories</p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="pointer-events-none relative grid grid-cols-2 gap-3 select-none">
          {ADOPTION_CARDS.map((card, index) => (
            <div
              key={card.title}
              className={`adopt-card-enter relative flex min-h-[10rem] overflow-hidden rounded-3xl bg-gradient-to-br ring-1 ${card.accentRing} ${card.cardGradient}`}
              style={{
                animationDelay: `${index * 120}ms`,
                boxShadow: `0 6px 24px ${card.glowColor}`,
              }}
            >
              <PawPrint
                className="pointer-events-none absolute right-2 top-2 h-8 w-8 text-black/[0.04]"
                aria-hidden
              />

              <div className="relative z-10 flex min-w-0 flex-1 flex-col p-3.5 pr-2">
                <div
                  className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${card.iconBg}`}
                  aria-hidden
                >
                  <card.Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.25} />
                </div>

                <h3 className="mb-0.5 text-[13px] font-bold leading-tight text-gray-900">
                  {card.title}
                </h3>
                <p className="mb-3 text-[11px] leading-snug text-gray-600">
                  {card.description}
                </p>

                <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-[#FF4D6D]/40 bg-white/90 px-3 py-1 text-[10px] font-semibold text-[#FF4D6D] shadow-sm">
                  <Sparkles className="h-2.5 w-2.5 opacity-70" aria-hidden />
                  Coming soon
                </span>
              </div>

              <div className="relative flex w-[4.75rem] shrink-0 flex-col justify-end">
                <div
                  className="adopt-pet-pop relative h-[4.75rem] w-full"
                  style={{ animationDelay: `${index * 200 + 400}ms` }}
                >
                  <Image
                    src={card.imageUrl}
                    alt={card.imageAlt}
                    fill
                    className="object-contain object-bottom"
                    sizes="76px"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="relative mt-3 text-center text-[10px] font-medium tracking-wide text-rose-400/80">
          Be the reason a tail wags · launching soon
        </p>
      </div>

      <style jsx>{`
        @keyframes adopt-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes adopt-heart-float {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-6px) scale(1.08);
            opacity: 0.65;
          }
        }
        @keyframes adopt-pet-pop {
          0% {
            transform: translateY(8px) scale(0.92);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes adopt-card-enter {
          0% {
            transform: translateY(12px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes adopt-soon-pulse {
          0%,
          100% {
            box-shadow: 0 2px 8px rgba(255, 140, 0, 0.4);
          }
          50% {
            box-shadow: 0 2px 16px rgba(255, 140, 0, 0.65);
          }
        }
        .adopt-hero-float {
          animation: adopt-float 3.5s ease-in-out infinite;
        }
        .adopt-heart-float {
          animation: adopt-heart-float 3s ease-in-out infinite;
        }
        .adopt-pet-pop {
          animation: adopt-pet-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .adopt-card-enter {
          animation: adopt-card-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .adopt-soon-pulse {
          animation: adopt-soon-pulse 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export const AdoptionSection = memo(AdoptionSectionComponent);
