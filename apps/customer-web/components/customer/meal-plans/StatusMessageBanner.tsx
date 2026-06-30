'use client';

import { AlertCircle, Check, Info } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { MealOrderStatusTone } from '@/components/customer/meal-plans/meal-plan-order-display';

const toneStyles: Record<
  MealOrderStatusTone,
  { wrap: string; icon: string; title: string; subtitle: string }
> = {
  green: {
    wrap: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    subtitle: 'text-emerald-800/90',
  },
  blue: {
    wrap: 'border-blue-200 bg-blue-50',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    subtitle: 'text-blue-800/90',
  },
  red: {
    wrap: 'border-red-200 bg-red-50',
    icon: 'text-red-600',
    title: 'text-red-900',
    subtitle: 'text-red-800/90',
  },
  amber: {
    wrap: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-700',
    title: 'text-amber-900',
    subtitle: 'text-amber-800/90',
  },
  orange: {
    wrap: 'border-orange-200 bg-orange-50',
    icon: 'text-orange-600',
    title: 'text-orange-900',
    subtitle: 'text-orange-800/90',
  },
  slate: {
    wrap: 'border-slate-200 bg-slate-50',
    icon: 'text-slate-600',
    title: 'text-slate-900',
    subtitle: 'text-slate-700',
  },
};

export interface StatusMessageBannerProps {
  tone: MealOrderStatusTone;
  title: string;
  subtitle?: string;
  className?: string;
}

export function StatusMessageBanner({ tone, title, subtitle, className }: StatusMessageBannerProps) {
  const styles = toneStyles[tone];
  const Icon = tone === 'green' ? Check : tone === 'red' ? AlertCircle : Info;

  return (
    <div
      className={cn('rounded-xl border px-3 py-2.5', styles.wrap, className)}
      role="status"
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold leading-snug', styles.title)}>{title}</p>
          {subtitle ? (
            <p className={cn('mt-0.5 text-xs leading-relaxed', styles.subtitle)}>{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
