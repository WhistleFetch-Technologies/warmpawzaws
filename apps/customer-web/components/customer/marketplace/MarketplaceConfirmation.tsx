'use client';

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import { formatInr } from '@/lib/pricing/format';
import {
  buildPromotionDetailLines,
  offerSourceLabel,
  offerSourceToBadgeVariant,
} from '@/lib/pricing/promotion-display';
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
  const promotionDetails = buildPromotionDetailLines({
    name: data.promotionLabel,
    promotionType: data.promotionTypeName,
    offerSource: data.offerSource,
    couponCode: data.couponCode,
  });

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden />
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

      {data.savingsAmount != null && data.savingsAmount > 0 ? (
        <div
          className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-center"
          role="status"
        >
          <p className="text-lg font-bold text-emerald-800">
            🎉 You saved {formatInr(data.savingsAmount)} today!
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <SavingsBadge variant="save_amount" amount={data.savingsAmount} />
            {data.couponCode ? (
              <SavingsBadge variant="coupon_applied" label={`Coupon: ${data.couponCode}`} />
            ) : null}
            {data.offerSource ? (
              <SavingsBadge
                variant={offerSourceToBadgeVariant(data.offerSource)}
                label={offerSourceLabel(data.offerSource)}
              />
            ) : null}
            {data.promotionLabel ? (
              <SavingsBadge variant="auto_applied" label={data.promotionLabel} />
            ) : null}
          </div>
        </div>
      ) : (data.promotionLabel || data.couponCode) ? (
        <div className="flex flex-wrap justify-center gap-2">
          {data.promotionLabel ? (
            <SavingsBadge variant="auto_applied" label={data.promotionLabel} />
          ) : null}
          {data.couponCode ? (
            <SavingsBadge variant="coupon_applied" label={`Coupon: ${data.couponCode}`} />
          ) : null}
        </div>
      ) : null}

      {promotionDetails.length > 0 ? (
        <div className={`${MARKETPLACE_CARD_CLASS} divide-y divide-slate-50`}>
          <div className="px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Offer applied</p>
          </div>
          {promotionDetails.map((line) => (
            <div key={line.label} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-slate-500">{line.label}</span>
              <span className="font-medium text-slate-900 text-right">{line.value}</span>
            </div>
          ))}
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
