'use client';

import { Tag, Sparkles, Ticket, Store, Globe } from 'lucide-react';
import { formatInr } from '@/lib/pricing/format';
import type { SavingsBadgeVariant } from '@/lib/pricing/types';

export type SavingsBadgeProps = {
  variant: SavingsBadgeVariant;
  amount?: number;
  label?: string;
  className?: string;
};

const variantConfig: Record<
  SavingsBadgeVariant,
  { icon: typeof Tag; defaultLabel: string; className: string }
> = {
  save_amount: {
    icon: Tag,
    defaultLabel: 'Save',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  auto_applied: {
    icon: Sparkles,
    defaultLabel: 'Auto applied',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  coupon_applied: {
    icon: Ticket,
    defaultLabel: 'Coupon applied',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  platform_offer: {
    icon: Globe,
    defaultLabel: 'Platform offer',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  vendor_offer: {
    icon: Store,
    defaultLabel: 'Vendor offer',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

export function SavingsBadge({ variant, amount, label, className = '' }: SavingsBadgeProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const text =
    label ??
    (variant === 'save_amount' && amount != null && amount > 0
      ? `Save ${formatInr(amount)}`
      : config.defaultLabel);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className} ${className}`}
      role="status"
      aria-label={text}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {text}
    </span>
  );
}
