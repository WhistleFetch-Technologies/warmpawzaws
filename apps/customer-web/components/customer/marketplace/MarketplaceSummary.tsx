'use client';

import type { ReactNode } from 'react';
import { MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';

export function MarketplaceSummary({
  title = 'Summary',
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={MARKETPLACE_CARD_CLASS}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function MarketplaceSummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'discount' | 'total';
}) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium tabular-nums ${
          emphasis === 'discount'
            ? 'text-emerald-600'
            : emphasis === 'total'
              ? 'text-orange-600 font-bold'
              : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
