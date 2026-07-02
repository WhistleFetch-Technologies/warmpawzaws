'use client';

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import { formatInr } from '@/lib/pricing/format';
import type { MarketplaceConfirmationData } from '@/lib/marketplace/types';
import { DOMAIN_LABELS, MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';
import { MarketplaceActions } from './MarketplaceActions';
import type { MarketplaceAction } from '@/lib/marketplace/types';

export function MarketplaceConfirmation({
  data,
  children,
  actions,
}: {
  data: MarketplaceConfirmationData;
  children?: ReactNode;
  actions: MarketplaceAction[];
}) {
  return (
    <div className="space-y-4 px-4 py-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
          {DOMAIN_LABELS[data.domain]} confirmed
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{data.title}</h1>
        {data.vendorName ? <p className="text-sm text-slate-500 mt-1">{data.vendorName}</p> : null}
      </div>

      <div className={`${MARKETPLACE_CARD_CLASS} p-4 text-center`}>
        <p className="text-xs text-slate-500">Order number</p>
        <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">{data.orderNumber}</p>
      </div>

      {(data.savingsAmount != null && data.savingsAmount > 0) || data.promotionLabel ? (
        <div className="flex flex-wrap justify-center gap-2">
          {data.savingsAmount != null && data.savingsAmount > 0 ? (
            <SavingsBadge variant="save_amount" amount={data.savingsAmount} />
          ) : null}
          {data.promotionLabel ? (
            <SavingsBadge variant="auto_applied" label={data.promotionLabel} />
          ) : null}
        </div>
      ) : null}

      <div className={`${MARKETPLACE_CARD_CLASS} divide-y divide-slate-50`}>
        {data.summaryLines?.map((line) => (
          <div key={line.label} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-slate-500">{line.label}</span>
            <span className="font-medium text-slate-900 text-right">{line.value}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 px-4 py-3 text-sm font-bold">
          <span className="text-slate-900">Amount paid</span>
          <span className="text-orange-600 tabular-nums">{formatInr(data.paidAmount)}</span>
        </div>
      </div>

      {children}

      <MarketplaceActions actions={actions} />
    </div>
  );
}
