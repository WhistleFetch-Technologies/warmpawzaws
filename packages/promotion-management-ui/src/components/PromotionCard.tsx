'use client';

import { Tag, Sparkles } from 'lucide-react';
import type { NormalizedPromotionItem } from '../types';
import { lifecycleFromPromotion } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';

function formatPromotionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PromotionCard({
  item,
  onClick,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: NormalizedPromotionItem;
  onClick?: () => void;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const lifecycle = lifecycleFromPromotion(item);
  const discountLabel =
    item.discountType === 'percentage'
      ? `${item.discountValue}% OFF`
      : `₹${item.discountValue} OFF`;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <PromotionStatusBadge status={lifecycle} />
              {item.kind === 'promotion' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" /> Auto applied
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Tag className="h-3 w-3" /> Coupon
                </span>
              )}
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {formatPromotionType(item.promotionType)}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
            {item.description ? (
              <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-lg bg-orange-500 text-white px-3 py-2 text-center min-w-[72px]">
            <div className="text-sm font-bold leading-tight">{discountLabel}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {item.code ? <span className="font-mono">{item.code}</span> : null}
          <span>
            {new Date(item.startDate).toLocaleDateString('en-IN')} –{' '}
            {new Date(item.endDate).toLocaleDateString('en-IN')}
          </span>
          {item.targetSummary ? (
            <span className="text-slate-600 font-medium">{item.targetSummary}</span>
          ) : null}
          {item.usageLimit != null ? (
            <span>
              Used {item.usageCount ?? 0}/{item.usageLimit}
            </span>
          ) : null}
        </div>

        {(onEdit || onDelete || onToggle) && (
          <div className="flex gap-2 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
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
