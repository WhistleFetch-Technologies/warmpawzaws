'use client';

import type { LucideIcon } from 'lucide-react';

export interface ProfileMetricItem {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  onClick?: () => void;
}

interface ProfileMetricStripProps {
  items: ProfileMetricItem[];
  className?: string;
}

export function ProfileMetricStrip({ items, className = '' }: ProfileMetricStripProps) {
  return (
    <div
      className={`relative z-[22] -mt-7 flex w-full gap-1 px-4 sm:-mt-8 sm:gap-1.5 sm:px-5 ${className}`}
    >
      {items.map(({ icon: Icon, iconBg, iconColor, value, label, onClick }) => {
        const inner = (
          <>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${iconBg}`}
              aria-hidden
            >
              <Icon className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${iconColor}`} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 text-center leading-tight">
              <span className="block truncate text-xs font-bold text-gray-900 sm:text-sm">{value}</span>
              <span className="mt-0.5 block truncate text-[9px] font-medium text-gray-500 sm:text-[10px]">
                {label}
              </span>
            </span>
          </>
        );

        if (onClick) {
          return (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-[0_4px_14px_rgba(0,0,0,0.08)] active:scale-[0.98] sm:p-2.5"
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-[0_4px_14px_rgba(0,0,0,0.08)] sm:p-2.5"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
