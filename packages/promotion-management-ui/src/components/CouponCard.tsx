'use client';

import { Copy, Check, Ticket } from 'lucide-react';
import { useState } from 'react';
import type { NormalizedCouponItem } from '../types';
import { lifecycleFromCoupon } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';

export function CouponCard({
  item,
  onClick,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: NormalizedCouponItem;
  onClick?: () => void;
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}) {
  const lifecycle = lifecycleFromCoupon(item);
  const [copied, setCopied] = useState(false);
  const discountLabel =
    item.discountType === 'percentage'
      ? `${item.discountValue}% OFF`
      : `₹${item.discountValue} OFF`;

  const remaining =
    item.usageLimit != null ? Math.max(0, item.usageLimit - (item.usageCount ?? 0)) : null;

  const copyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white overflow-hidden hover:shadow-md transition cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <PromotionStatusBadge status={lifecycle} />
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                <Ticket className="h-3 w-3" /> Coupon
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-bold text-slate-900 truncate">{item.code}</p>
              <button
                type="button"
                onClick={copyCode}
                title="Copy code"
                className="shrink-0 rounded-md border border-amber-200 bg-white p-1.5 hover:bg-amber-50"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-amber-700" />
                )}
              </button>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{discountLabel}</p>
          </div>
          <div className="shrink-0 rounded-lg bg-amber-500 text-white px-3 py-2 text-center min-w-[72px]">
            <div className="text-sm font-bold leading-tight">{discountLabel}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>
            {new Date(item.startDate).toLocaleDateString('en-IN')} –{' '}
            {new Date(item.endDate).toLocaleDateString('en-IN')}
          </span>
          {item.usageLimit != null ? (
            <span>
              Used {item.usageCount ?? 0}/{item.usageLimit}
            </span>
          ) : null}
          {remaining != null ? <span>{remaining} remaining</span> : null}
        </div>

        {(onEdit || onDelete || onToggle) && (
          <div className="flex gap-2 pt-1 border-t border-amber-100" onClick={(e) => e.stopPropagation()}>
            {onToggle ? (
              <button type="button" onClick={onToggle} className="text-xs font-medium text-slate-600">
                {item.isActive ? 'Deactivate' : 'Activate'}
              </button>
            ) : null}
            {onEdit ? (
              <button type="button" onClick={onEdit} className="text-xs font-medium text-orange-600">
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 ml-auto">
                Delete
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}