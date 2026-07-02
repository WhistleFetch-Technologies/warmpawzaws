'use client';

import type { NormalizedCouponItem, NormalizedPromotionItem } from '../types';
import { lifecycleFromPromotion } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import { PromotionTimeline } from './PromotionTimeline';
import { ComingSoonSection } from './ComingSoonSection';

export function PromotionDetailsPanel({
  item,
  coupon,
  onClose,
}: {
  item?: NormalizedPromotionItem | null;
  coupon?: NormalizedCouponItem | null;
  onClose: () => void;
}) {
  const record = item ?? coupon;
  if (!record) return null;

  const lifecycle = item
    ? lifecycleFromPromotion(item)
    : coupon
      ? lifecycleFromPromotion({
          id: coupon.id,
          kind: 'coupon',
          name: coupon.code,
          promotionType: 'coupon',
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          startDate: coupon.startDate,
          endDate: coupon.endDate,
          isActive: coupon.isActive,
        })
      : 'draft';

  const start = item?.startDate ?? coupon!.startDate;
  const end = item?.endDate ?? coupon!.endDate;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">Details</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
          <PromotionStatusBadge status={lifecycle} />
          <h3 className="text-xl font-bold text-slate-900 mt-2">
            {item?.name ?? coupon?.code}
          </h3>
          {item?.description ? (
            <p className="text-sm text-slate-500 mt-1">{item.description}</p>
          ) : null}
        </div>

        <section>
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Discount</h4>
          <p className="text-sm text-slate-800">
            {(item?.discountType ?? coupon?.discountType) === 'percentage'
              ? `${item?.discountValue ?? coupon?.discountValue}% off`
              : `₹${item?.discountValue ?? coupon?.discountValue} off`}
          </p>
          {item?.maxDiscount ? (
            <p className="text-xs text-slate-500">Max ₹{item.maxDiscount}</p>
          ) : null}
        </section>

        {item?.targetSummary ? (
          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Target</h4>
            <p className="text-sm text-slate-800">{item.targetSummary}</p>
          </section>
        ) : null}

        <section>
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Usage</h4>
          <p className="text-sm text-slate-800">
            {(item?.usageCount ?? coupon?.usageCount ?? 0).toString()}
            {item?.usageLimit ?? coupon?.usageLimit
              ? ` / ${item?.usageLimit ?? coupon?.usageLimit}`
              : ' uses'}
          </p>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Timeline</h4>
          <PromotionTimeline current={lifecycle} startDate={start} endDate={end} />
        </section>

        <ComingSoonSection />
      </div>
    </div>
  );
}
