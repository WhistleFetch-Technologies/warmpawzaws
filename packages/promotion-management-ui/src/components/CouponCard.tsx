'use client';

import { Ticket } from 'lucide-react';
import type { NormalizedCouponItem } from '../types';
import { lifecycleFromCoupon } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';

export function CouponCard({
  item,
  onClick,
  onDelete,
}: {
  item: NormalizedCouponItem;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const lifecycle = lifecycleFromCoupon(item);
  const discountLabel =
    item.discountType === 'percentage'
      ? `${item.discountValue}% OFF`
      : `₹${item.discountValue} OFF`;

  return (
    <div
      className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-4 hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <PromotionStatusBadge status={lifecycle} />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900">
              <Ticket className="h-3 w-3" /> Customer enters code
            </span>
          </div>
          <p className="font-mono text-lg font-bold text-slate-900">{item.code}</p>
          <p className="text-sm text-slate-600 mt-1">{discountLabel}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>
            {new Date(item.startDate).toLocaleDateString('en-IN')} –{' '}
            {new Date(item.endDate).toLocaleDateString('en-IN')}
          </p>
          {item.usageLimit != null ? (
            <p className="mt-1">
              {item.usageCount ?? 0}/{item.usageLimit} used
            </p>
          ) : null}
        </div>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mt-3 text-xs font-medium text-red-600"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
