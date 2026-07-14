'use client';

import { cn } from '@/components/ui/utils';
import type { MealOrderStatusTone } from '@/components/customer/meal-plans/meal-plan-order-display';

const toneClasses: Record<MealOrderStatusTone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-900',
  orange: 'bg-orange-100 text-orange-800',
  slate: 'bg-slate-100 text-slate-700',
};

export interface StatusChipProps {
  label: string;
  tone: MealOrderStatusTone;
  className?: string;
}

export function StatusChip({ label, tone, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
