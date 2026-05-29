'use client';

import React, { memo } from 'react';
import { CircleCheck, Headphones, Lock, ShieldCheck } from 'lucide-react';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

const TRUST_FEATURES = [
  {
    id: 'book',
    label: 'Book in Minutes',
    subtitle: 'Quick & easy',
    icon: CircleCheck,
    clickable: false,
    iconClass: 'text-orange-500',
    glowClass: 'bg-orange-400/25 shadow-[0_0_12px_rgba(249,115,22,0.35)]',
  },
  {
    id: 'verified',
    label: 'Verified Experts',
    subtitle: 'Background checked',
    icon: ShieldCheck,
    clickable: false,
    iconClass: 'text-blue-500',
    glowClass: 'bg-blue-400/25 shadow-[0_0_12px_rgba(59,130,246,0.35)]',
  },
  {
    id: 'payments',
    label: 'Secure Payments',
    subtitle: '100% safe',
    icon: Lock,
    clickable: false,
    iconClass: 'text-emerald-500',
    glowClass: 'bg-emerald-400/25 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
  },
  {
    id: 'support',
    label: '24/7 Support',
    subtitle: "We're here",
    icon: Headphones,
    clickable: true,
    iconClass: 'text-violet-500',
    glowClass: 'bg-violet-400/25 shadow-[0_0_12px_rgba(139,92,246,0.35)]',
  },
] as const;

export interface TrustFeatureBarProps {
  /** When provided, “24/7 Support” opens support_help. Other items stay static. */
  onNavigate?: HomeNavigateFn;
  className?: string;
}

function TrustFeatureBarComponent({ onNavigate, className = '' }: TrustFeatureBarProps) {
  const supportAvailable = Boolean(onNavigate);

  return (
    <div className={`px-4 mb-4 ${className}`}>
      <div className="flex items-stretch divide-x divide-gray-200 rounded-xl bg-white py-3">
        {TRUST_FEATURES.map(({ id, label, subtitle, icon: Icon, clickable, iconClass, glowClass }, index) => {
          const isSupport = id === 'support';
          const canClick = isSupport && clickable && supportAvailable;

          const inner = (
            <>
              <div
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${glowClass}`}
              >
                <Icon className={`relative h-4 w-4 ${iconClass}`} strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[10px] font-semibold leading-tight text-gray-900 sm:text-xs">
                  {label}
                </p>
                <p className="truncate text-[9px] leading-tight text-gray-500 sm:text-[10px]">{subtitle}</p>
              </div>
            </>
          );

          const itemClass =
            'flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:gap-2 sm:px-3' +
            (index === 0 ? ' pl-1 sm:pl-2' : '') +
            (index === TRUST_FEATURES.length - 1 ? ' pr-1 sm:pr-2' : '');

          if (canClick) {
            return (
              <button
                key={id}
                type="button"
                className={`${itemClass} active:opacity-80`}
                aria-label={`${label} — open support`}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
                  }
                  onNavigate?.('support_help', { initialTab: 'contact' });
                }}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={id} className={`${itemClass} select-none`} aria-label={label}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Static trust signals row — only 24/7 Support is tappable when onNavigate is provided. */
export const TrustFeatureBar = memo(TrustFeatureBarComponent);
