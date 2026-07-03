'use client';

import type { NormalizedCouponItem, NormalizedPromotionItem } from '../types';
import { lifecycleFromPromotion, lifecycleFromCoupon } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import { PromotionTimeline } from './PromotionTimeline';
import { ComingSoonSection } from './ComingSoonSection';

function formatPromotionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function audienceLabel(audience?: string): string {
  const map: Record<string, string> = {
    all: 'All customers',
    new_users: 'First-time customers',
    returning_users: 'Returning customers',
    vip: 'VIP customers',
    segments: 'Custom segments',
  };
  return audience ? (map[audience] ?? audience) : 'All customers';
}

export function PromotionDetailsPanel({
  item,
  coupon,
  onClose,
  onEdit,
}: {
  item?: NormalizedPromotionItem | null;
  coupon?: NormalizedCouponItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const record = item ?? coupon;
  if (!record) return null;

  const lifecycle = item
    ? lifecycleFromPromotion(item)
    : coupon
      ? lifecycleFromCoupon(coupon)
      : 'draft';

  const start = item?.startDate ?? coupon!.startDate;
  const end = item?.endDate ?? coupon!.endDate;
  const isCoupon = Boolean(coupon);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isCoupon ? 'Coupon details' : 'Promotion details'}
          </h2>
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-sm font-medium text-orange-600"
              >
                Edit
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="text-sm text-slate-500">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PromotionStatusBadge status={lifecycle} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {isCoupon ? 'Coupon' : 'Promotion'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-2">
              {item?.name ?? coupon?.code}
            </h3>
            {item?.description ? (
              <p className="text-sm text-slate-500 mt-1">{item.description}</p>
            ) : null}
            {item?.promotionType ? (
              <p className="text-xs text-slate-500 mt-1">
                Type: {formatPromotionType(item.promotionType)}
              </p>
            ) : null}
          </div>

          {isCoupon && coupon ? (
            <section>
              <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Coupon code</h4>
              <p className="font-mono text-lg font-bold text-slate-900">{coupon.code}</p>
            </section>
          ) : null}

          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Discount</h4>
            <p className="text-sm text-slate-800">
              {(item?.discountType ?? coupon?.discountType) === 'percentage'
                ? `${item?.discountValue ?? coupon?.discountValue}% off`
                : `₹${item?.discountValue ?? coupon?.discountValue} off`}
            </p>
            {item?.maxDiscount ? (
              <p className="text-xs text-slate-500 mt-0.5">Max ₹{item.maxDiscount}</p>
            ) : null}
            {item?.minAmount ?? coupon?.minAmount ? (
              <p className="text-xs text-slate-500 mt-0.5">
                Min order ₹{item?.minAmount ?? coupon?.minAmount}
              </p>
            ) : null}
          </section>

          {item?.targetSummary ? (
            <section>
              <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Targets</h4>
              <p className="text-sm text-slate-800">{item.targetSummary}</p>
            </section>
          ) : null}

          {item?.audience ? (
            <section>
              <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Audience</h4>
              <p className="text-sm text-slate-800">{audienceLabel(item.audience)}</p>
            </section>
          ) : null}

          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Schedule</h4>
            <p className="text-sm text-slate-800">
              {new Date(start).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              –{' '}
              {new Date(end).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Usage</h4>
            <p className="text-sm text-slate-800">
              {(item?.usageCount ?? coupon?.usageCount ?? 0).toString()}
              {item?.usageLimit ?? coupon?.usageLimit
                ? ` / ${item?.usageLimit ?? coupon?.usageLimit} total`
                : ' redemptions'}
            </p>
            {item?.usageLimitPerUser ? (
              <p className="text-xs text-slate-500 mt-0.5">
                Max {item.usageLimitPerUser} per customer
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Lifecycle</h4>
            <PromotionTimeline current={lifecycle} startDate={start} endDate={end} />
          </section>

          <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">
              Vendor funding
            </h4>
            <p className="text-sm text-slate-500">Funding breakdown — coming in a future sprint</p>
          </section>

          <ComingSoonSection />
        </div>
      </div>
    </>
  );
}
