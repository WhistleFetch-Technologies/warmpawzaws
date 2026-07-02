'use client';

import type { ReactNode } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { PriceDisplay } from '@/components/customer/pricing/PriceDisplay';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import type { MarketplaceHistoryItem } from '@/lib/marketplace/types';
import { DOMAIN_LABELS, MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';
import { MarketplaceStatus } from './MarketplaceStatus';

const TONE_MAP = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  muted: 'muted',
} as const;

export function MarketplaceHistoryCard({
  item,
  onClick,
  children,
  actions,
}: {
  item: MarketplaceHistoryItem;
  onClick?: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const original =
    item.originalPrice && item.originalPrice > item.paidAmount
      ? item.originalPrice
      : item.savingsAmount && item.savingsAmount > 0
        ? item.paidAmount + item.savingsAmount
        : item.paidAmount;
  const showSavings = original > item.paidAmount;

  return (
    <article
      className={`${MARKETPLACE_CARD_CLASS} overflow-hidden p-4 ${
        onClick ? 'cursor-pointer hover:border-orange-200 transition-colors' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-orange-50 flex items-center justify-center text-xl">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            item.imageFallback ?? '🐾'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold uppercase text-slate-400">
                  {DOMAIN_LABELS[item.domain]}
                </span>
                <MarketplaceStatus
                  label={item.statusLabel}
                  tone={TONE_MAP[item.statusTone ?? 'default']}
                />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm truncate">{item.title}</h3>
              {item.vendorName ? (
                <p className="text-xs text-slate-500 truncate">{item.vendorName}</p>
              ) : null}
              {item.subtitle ? (
                <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              {showSavings ? (
                <PriceDisplay
                  originalPrice={original}
                  currentPrice={item.paidAmount}
                  size="sm"
                  showSavings={false}
                />
              ) : (
                <p className="text-sm font-bold text-orange-600 tabular-nums">
                  ₹{item.paidAmount.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {item.dateLabel ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {item.dateLabel}
              </span>
            ) : null}
            {item.timeLabel ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.timeLabel}
              </span>
            ) : null}
            {item.displayId ? <span className="font-mono">{item.displayId}</span> : null}
          </div>

          {(item.savingsAmount != null && item.savingsAmount > 0) || item.promotionLabel ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.savingsAmount != null && item.savingsAmount > 0 ? (
                <SavingsBadge variant="save_amount" amount={item.savingsAmount} />
              ) : null}
              {item.promotionLabel ? (
                <SavingsBadge variant="auto_applied" label={item.promotionLabel} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {children ? <div className="mt-3 space-y-2">{children}</div> : null}
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}
