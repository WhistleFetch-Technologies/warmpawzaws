'use client';

import React, { memo } from 'react';
import { CircleCheck, Headphones, Lock, ShieldCheck } from 'lucide-react';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';

const TRUST_ITEMS = [
  {
    id: 'book',
    label: 'Book in Minutes',
    subtitle: 'Quick & easy',
    icon: CircleCheck,
    iconBg: 'bg-orange-100',
    iconClass: 'text-orange-500',
  },
  {
    id: 'verified',
    label: 'Verified Experts',
    subtitle: 'Background checked',
    icon: ShieldCheck,
    iconBg: 'bg-blue-100',
    iconClass: 'text-blue-500',
  },
  {
    id: 'payments',
    label: 'Secure Payments',
    subtitle: '100% safe',
    icon: Lock,
    iconBg: 'bg-emerald-100',
    iconClass: 'text-emerald-500',
  },
  {
    id: 'support',
    label: '24/7 Support',
    subtitle: "We're here",
    icon: Headphones,
    iconBg: 'bg-violet-100',
    iconClass: 'text-violet-500',
    clickable: true,
  },
] as const;

export interface AllServicesTrustBarProps {
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
  className?: string;
}

function AllServicesTrustBarComponent({ onNavigate, className = '' }: AllServicesTrustBarProps) {
  return (
    <div className={`mt-6 ${className}`}>
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        Why pet parents trust us
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {TRUST_ITEMS.map(({ id, label, subtitle, icon: Icon, iconBg, iconClass, ...rest }) => {
          const clickable = 'clickable' in rest && rest.clickable && onNavigate;
          const inner = (
            <>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
              >
                <Icon className={`h-4 w-4 ${iconClass}`} strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold leading-tight text-gray-900">
                  {label}
                </p>
                <p className="truncate text-[10px] leading-tight text-gray-500">{subtitle}</p>
              </div>
            </>
          );

          const cardClass =
            'flex items-center gap-2.5 rounded-2xl border border-gray-100/80 bg-white p-3 shadow-sm transition-all';

          if (clickable) {
            return (
              <button
                key={id}
                type="button"
                className={`${cardClass} active:scale-[0.98] hover:border-violet-200 hover:shadow-md`}
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
            <div key={id} className={cardClass} aria-label={label}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const AllServicesTrustBar = memo(AllServicesTrustBarComponent);
