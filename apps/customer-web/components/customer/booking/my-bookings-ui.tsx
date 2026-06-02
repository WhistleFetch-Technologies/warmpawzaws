'use client';

import type { LucideIcon, MouseEvent, ReactNode } from 'react';
import { ChevronRight, LayoutGrid, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/components/ui/utils';

/**
 * White body shell overlapping the orange header (My Bookings only).
 * -mt-6 = 24px overlap; stats use mb-5 (20px) in header so cards do not touch this shell.
 */
export const MY_BOOKINGS_CONTENT_SHELL_CLASS =
  'relative z-10 -mt-6 rounded-t-[32px] bg-white pt-6 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] sm:pt-6';

/** Shared elevation + radius for My Bookings surfaces */
export const myBookingsCardClass =
  'rounded-2xl border border-gray-100/90 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200';

export const myBookingsPressableClass =
  'active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8C42]';

export type MyBookingsFilterId = 'all' | 'upcoming' | 'completed';

const FILTER_TABS: { id: MyBookingsFilterId; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
];

type TrackingTone = 'emerald' | 'blue';

const TRACKING_TONES: Record<
  TrackingTone,
  { wrap: string; iconBox: string; icon: string; title: string; desc: string; badge: string }
> = {
  emerald: {
    wrap: 'from-emerald-50/90 via-white to-white border-emerald-100/80',
    iconBox: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_4px_14px_rgba(16,185,129,0.35)]',
    icon: 'text-white',
    title: 'text-emerald-900',
    desc: 'text-gray-500',
    badge: '',
  },
  blue: {
    wrap: 'from-blue-50/90 via-white to-white border-blue-100/80',
    iconBox: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.35)]',
    icon: 'text-white',
    title: 'text-blue-900',
    desc: 'text-gray-500',
    badge: 'rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm',
  },
};

export function MyBookingsTrackingRow({
  tone,
  icon: Icon,
  title,
  description,
  disabled,
  showSoonBadge,
  onClick,
  ariaLabel,
}: {
  tone: TrackingTone;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled: boolean;
  showSoonBadge?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const t = TRACKING_TONES[tone];
  return (
    <div className="my-bookings-fade-in">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          myBookingsCardClass,
          myBookingsPressableClass,
          'w-full bg-gradient-to-br p-4 text-left',
          t.wrap,
          disabled && 'cursor-not-allowed opacity-75 hover:shadow-[0_4px_20px_rgba(15,23,42,0.06)] active:scale-100'
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              t.iconBox,
              disabled && 'opacity-60'
            )}
          >
            <Icon className={cn('h-5 w-5', t.icon)} strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-sm font-semibold sm:text-base', t.title, disabled && 'opacity-80')}>
                {title}
              </span>
              {showSoonBadge ? <span className={t.badge}>Soon</span> : null}
            </div>
            <p className={cn('mt-0.5 text-xs leading-relaxed', t.desc, disabled && 'text-gray-400')}>
              {description}
            </p>
          </div>
          {!disabled ? (
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          ) : null}
        </div>
      </button>
    </div>
  );
}

export function MyBookingsFilterTabs({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: MyBookingsFilterId;
  onFilterChange: (id: MyBookingsFilterId) => void;
}) {
  return (
    <div
      className={cn(myBookingsCardClass, 'flex gap-2 p-1.5')}
      role="tablist"
      aria-label="Filter bookings"
    >
      {FILTER_TABS.map((tab) => {
        const active = activeFilter === tab.id;
        const TabIcon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onFilterChange(tab.id)}
            className={cn(
              'flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-gradient-to-r from-[#FF7A3D] to-[#FF9257] text-white shadow-[0_4px_16px_rgba(255,122,61,0.35)]'
                : 'bg-gray-50/80 text-gray-600 hover:bg-gray-100 active:scale-[0.98]'
            )}
          >
            <TabIcon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MyBookingsEmptyState({
  activeFilter,
}: {
  activeFilter: MyBookingsFilterId;
}) {
  return (
    <div
      className={cn(
        myBookingsCardClass,
        'flex flex-col items-center px-6 py-16 text-center my-bookings-fade-in'
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
        <LayoutGrid className="h-8 w-8 text-gray-300" aria-hidden />
      </div>
      <p className="text-base font-semibold text-gray-700">No bookings found</p>
      <p className="mt-1 max-w-[240px] text-sm leading-relaxed text-gray-500">
        {activeFilter === 'all'
          ? 'Book your first service to get started!'
          : `No ${activeFilter} bookings right now.`}
      </p>
    </div>
  );
}

export function MyBookingsBookingCardShell({
  children,
  onClick,
  animationDelayMs,
}: {
  children: ReactNode;
  onClick: () => void;
  /** Stagger list entrance */
  animationDelayMs?: number;
}) {
  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      className={cn(
        myBookingsCardClass,
        myBookingsPressableClass,
        'cursor-pointer overflow-hidden p-4 sm:p-5 hover:border-[#FF8C42]/25 my-bookings-card-enter'
      )}
    >
      {children}
    </article>
  );
}

export function MyBookingsMetaRow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-gray-600">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 shadow-sm">
        <Icon className="h-4 w-4 text-[#FF8C42]" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0 leading-snug">{children}</span>
    </div>
  );
}

export function MyBookingsQuickAction({
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  tone: 'blue' | 'green' | 'yellow';
  icon: LucideIcon;
  label: string;
  onClick: (e: MouseEvent) => void;
}) {
  const tones = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100/80 text-blue-700 border-blue-100',
    green: 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-emerald-700 border-emerald-100',
    yellow: 'bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-800 border-amber-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]',
        tones[tone]
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {label}
    </button>
  );
}
