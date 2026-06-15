'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import {
  Headphones,
  Heart,
  Lock,
  MessageCircle,
  MessageSquare,
  PawPrint,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const SUPPORT_IMAGE = '/images/home/support/support.webp';

const FEATURE_ITEMS = [
  {
    id: 'support',
    title: '24/7 Support',
    subtitle: "We're here anytime you need us",
    Icon: ShieldCheck,
    iconClass: 'text-[#FF7A00]',
  },
  {
    id: 'friendly',
    title: 'Friendly Team',
    subtitle: 'Real people, ready to help',
    Icon: Heart,
    iconClass: 'text-pink-400',
  },
  {
    id: 'secure',
    title: 'Safe & Secure',
    subtitle: 'Your privacy and trust are our priority',
    Icon: Lock,
    iconClass: 'text-emerald-500',
  },
] as const;

const BACKGROUND_ICONS = [
  { Icon: Headphones, wrapperClass: 'left-3 top-8', iconClass: 'h-10 w-10 text-orange-200/50', driftClass: 'need-help-bg-drift-1' },
  { Icon: MessageCircle, wrapperClass: 'right-24 top-6', iconClass: 'h-8 w-8 text-pink-200/45', driftClass: 'need-help-bg-drift-2' },
  { Icon: Heart, wrapperClass: 'left-1/3 top-1/2 -translate-y-1/2', iconClass: 'h-12 w-12 text-rose-200/35', driftClass: 'need-help-bg-drift-3' },
  { Icon: PawPrint, wrapperClass: 'bottom-24 left-6', iconClass: 'h-9 w-9 text-orange-200/40', driftClass: 'need-help-bg-drift-4' },
  { Icon: ShieldCheck, wrapperClass: 'right-8 top-1/3', iconClass: 'h-7 w-7 text-amber-200/45', driftClass: 'need-help-bg-drift-5' },
  { Icon: MessageSquare, wrapperClass: 'bottom-32 right-1/3', iconClass: 'h-8 w-8 text-pink-200/35', driftClass: 'need-help-bg-drift-6' },
] as const;

function DotGrid({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none grid grid-cols-4 gap-1.5 opacity-40 ${className ?? ''}`}
      aria-hidden
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-[#FF7A00]/30" />
      ))}
    </div>
  );
}

export interface NeedHelpSectionProps {
  onNavigate: HomeNavigateFn;
  className?: string;
}

function openSupport(onNavigate: HomeNavigateFn) {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
    }
    onNavigate('support_help', { initialTab: 'contact' });
  } catch {
    toast.error('Could not open support. Please try again.');
  }
}

function NeedHelpSectionComponent({ onNavigate, className = '' }: NeedHelpSectionProps) {
  return (
    <div className={`px-4 ${className}`}>
      <div className="need-help-enter relative overflow-hidden rounded-[2rem] border-2 border-[#FF7A00] bg-gradient-to-br from-[#FFE5D9] via-[#FFE8DE] to-[#FFD6E0] shadow-[0_8px_32px_rgba(255,122,0,0.12)]">
        {/* Light decorative background icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {BACKGROUND_ICONS.map(({ Icon, wrapperClass, iconClass, driftClass }, index) => (
            <span key={index} className={`absolute ${wrapperClass}`}>
              <Icon
                className={`need-help-bg-drift ${driftClass} ${iconClass}`}
                strokeWidth={1.5}
              />
            </span>
          ))}
          <div className="need-help-dot-grid absolute left-4 top-4">
            <DotGrid />
          </div>
          <div className="need-help-dot-grid need-help-dot-grid-delay absolute right-6 top-1/2 -translate-y-1/2 opacity-30">
            <DotGrid className="[&_span]:bg-pink-300/35" />
          </div>
          <span className="need-help-circle-breathe absolute bottom-20 left-3 h-14 w-14 rounded-full bg-orange-200/25" />
          <span className="need-help-circle-breathe need-help-circle-breathe-delay absolute bottom-16 left-8 h-10 w-10 rounded-full bg-orange-200/20" />
          <span className="need-help-circle-breathe need-help-circle-breathe-delay-2 absolute bottom-24 left-14 h-6 w-6 rounded-full bg-pink-200/25" />
        </div>

        {/* Main content */}
        <div className="relative px-4 pb-0 pt-5 sm:px-5">
          <div className="flex items-end gap-1 sm:gap-2">
            <div className="min-w-0 flex-1 pb-3">
              <div className="need-help-headset-pulse mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm">
                <Headphones className="h-4 w-4 text-[#FF7A00]" strokeWidth={2} aria-hidden />
              </div>

              <h2 className="mb-1.5 text-left text-xl font-bold leading-tight text-[#1A202C] sm:text-2xl">
                Need <span className="text-[#FF7A00]">Help?</span>{' '}
                <span aria-hidden>🤝</span>
              </h2>
              <p className="mb-4 max-w-[220px] text-left text-xs leading-relaxed text-[#4A5568] sm:text-sm">
                Our support team is available 24/7 to assist you anytime, anywhere.
              </p>

              <button
                type="button"
                className="need-help-btn-glow inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#FF9A3D] to-[#FF7A00] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,122,0,0.35)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:px-7 sm:py-3"
                onClick={() => openSupport(onNavigate)}
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Live Chat
              </button>

              <p className="mt-2.5 flex items-center gap-1.5 text-left text-[11px] text-[#4A5568] sm:text-xs">
                <span className="need-help-status-dot h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                We typically reply in under 1 min
              </p>
            </div>

            {/* Mascot + floating badges */}
            <div className="relative mb-[-8px] w-[42%] max-w-[148px] shrink-0 self-end sm:max-w-[168px]">
              <div
                className="need-help-badge-bob pointer-events-none absolute -left-1 top-6 z-10 rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 shadow-md"
                aria-hidden
              >
                <div className="flex gap-1">
                  <span className="need-help-typing-dot need-help-typing-dot-1 h-1.5 w-1.5 rounded-full bg-[#FF7A00]/70" />
                  <span className="need-help-typing-dot need-help-typing-dot-2 h-1.5 w-1.5 rounded-full bg-[#FF7A00]/70" />
                  <span className="need-help-typing-dot need-help-typing-dot-3 h-1.5 w-1.5 rounded-full bg-[#FF7A00]/70" />
                </div>
              </div>

              <div
                className="need-help-badge-pulse pointer-events-none absolute -right-0.5 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FF7A00]/20 bg-white shadow-md"
                aria-hidden
              >
                <span className="text-[9px] font-bold leading-none text-[#FF7A00]">24/7</span>
              </div>

              <Image
                src={SUPPORT_IMAGE}
                alt="Warmpawz support mascot ready to help"
                width={336}
                height={336}
                className="need-help-mascot-float relative z-[1] h-auto w-full object-contain object-bottom drop-shadow-sm"
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Bottom feature bar */}
        <div className="relative z-[2] mx-2 mb-2 rounded-2xl bg-white px-1 py-3 shadow-sm sm:mx-3 sm:px-2">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {FEATURE_ITEMS.map(({ id, title, subtitle, Icon, iconClass }, index) => (
              <div
                key={id}
                className={`need-help-feature-item need-help-feature-item-${index + 1} flex min-w-0 flex-col items-center px-1 text-center sm:px-2`}
              >
                <Icon className={`mb-1 h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={2} aria-hidden />
                <p className="text-[10px] font-bold leading-tight text-[#1A202C] sm:text-[11px]">{title}</p>
                <p className="mt-0.5 hidden text-[9px] leading-snug text-[#718096] sm:block">{subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes need-help-enter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes need-help-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes need-help-bg-drift {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(3px, -4px) rotate(3deg);
          }
        }
        @keyframes need-help-circle-breathe {
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
        @keyframes need-help-dot-grid {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.55;
          }
        }
        @keyframes need-help-headset-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 122, 0, 0.2);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(255, 122, 0, 0);
          }
        }
        @keyframes need-help-btn-glow {
          0%,
          100% {
            box-shadow: 0 4px 14px rgba(255, 122, 0, 0.35);
          }
          50% {
            box-shadow: 0 6px 20px rgba(255, 122, 0, 0.48);
          }
        }
        @keyframes need-help-status-dot {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.65;
            transform: scale(0.92);
          }
        }
        @keyframes need-help-badge-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        @keyframes need-help-badge-pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(255, 122, 0, 0.12);
          }
          50% {
            transform: scale(1.06);
            box-shadow: 0 4px 12px rgba(255, 122, 0, 0.2);
          }
        }
        @keyframes need-help-typing-dot {
          0%,
          60%,
          100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }
        @keyframes need-help-feature-rise {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .need-help-enter {
          animation: need-help-enter 0.55s ease-out both;
        }
        .need-help-mascot-float {
          animation: need-help-float 4.2s ease-in-out infinite;
        }
        .need-help-bg-drift {
          animation: need-help-bg-drift 7s ease-in-out infinite;
        }
        .need-help-bg-drift-1 {
          animation-delay: 0s;
        }
        .need-help-bg-drift-2 {
          animation-delay: -1.2s;
        }
        .need-help-bg-drift-3 {
          animation-delay: -2.4s;
        }
        .need-help-bg-drift-4 {
          animation-delay: -3.6s;
        }
        .need-help-bg-drift-5 {
          animation-delay: -4.8s;
        }
        .need-help-bg-drift-6 {
          animation-delay: -6s;
        }
        .need-help-circle-breathe {
          animation: need-help-circle-breathe 5s ease-in-out infinite;
        }
        .need-help-circle-breathe-delay {
          animation-delay: -1.5s;
        }
        .need-help-circle-breathe-delay-2 {
          animation-delay: -3s;
        }
        .need-help-dot-grid {
          animation: need-help-dot-grid 4s ease-in-out infinite;
        }
        .need-help-dot-grid-delay {
          animation-delay: -2s;
        }
        .need-help-headset-pulse {
          animation: need-help-headset-pulse 2.8s ease-out infinite;
        }
        .need-help-btn-glow {
          animation: need-help-btn-glow 2.6s ease-in-out infinite;
        }
        .need-help-status-dot {
          animation: need-help-status-dot 2s ease-in-out infinite;
        }
        .need-help-badge-bob {
          animation: need-help-badge-bob 3.2s ease-in-out infinite;
        }
        .need-help-badge-pulse {
          animation: need-help-badge-pulse 3s ease-in-out infinite;
        }
        .need-help-typing-dot {
          animation: need-help-typing-dot 1.4s ease-in-out infinite;
        }
        .need-help-typing-dot-1 {
          animation-delay: 0s;
        }
        .need-help-typing-dot-2 {
          animation-delay: 0.2s;
        }
        .need-help-typing-dot-3 {
          animation-delay: 0.4s;
        }
        .need-help-feature-item {
          animation: need-help-feature-rise 0.5s ease-out both;
        }
        .need-help-feature-item-1 {
          animation-delay: 0.35s;
        }
        .need-help-feature-item-2 {
          animation-delay: 0.45s;
        }
        .need-help-feature-item-3 {
          animation-delay: 0.55s;
        }

        @media (prefers-reduced-motion: reduce) {
          .need-help-enter,
          .need-help-mascot-float,
          .need-help-bg-drift,
          .need-help-circle-breathe,
          .need-help-dot-grid,
          .need-help-headset-pulse,
          .need-help-btn-glow,
          .need-help-status-dot,
          .need-help-badge-bob,
          .need-help-badge-pulse,
          .need-help-typing-dot,
          .need-help-feature-item {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export const NeedHelpSection = memo(NeedHelpSectionComponent);
