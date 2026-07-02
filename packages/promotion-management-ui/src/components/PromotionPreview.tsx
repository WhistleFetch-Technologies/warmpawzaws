'use client';

import { Sparkles, Ticket } from 'lucide-react';
import type { PromotionWizardForm } from '../types';

/** UI-only preview from wizard values — no backend simulation. */
export function PromotionPreview({ form }: { form: PromotionWizardForm }) {
  const isCoupon = form.createKind === 'coupon';
  const headline = isCoupon
    ? form.code || 'COUPON_CODE'
    : form.name || 'Your promotion';
  const savings =
    form.discountType === 'percentage'
      ? `${form.discountValue}% OFF`
      : `₹${form.discountValue} OFF`;

  const examplePrice = 899;
  const estimated =
    form.discountType === 'percentage'
      ? Math.max(0, examplePrice - (examplePrice * form.discountValue) / 100)
      : Math.max(0, examplePrice - form.discountValue);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">
          Customer view
        </p>
        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {isCoupon ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <Ticket className="h-3 w-3" /> Coupon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                <Sparkles className="h-3 w-3" /> Auto applied
              </span>
            )}
            <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {savings}
            </span>
          </div>
          <p className="font-semibold text-slate-900">{headline}</p>
          {form.description ? (
            <p className="text-sm text-slate-500 mt-1">{form.description}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-slate-400 line-through">₹{examplePrice}</span>
            <span className="text-lg font-bold text-orange-600">₹{estimated.toFixed(0)}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Illustrative — actual price depends on cart</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-2">
        <p className="font-semibold text-slate-900">Applicable to</p>
        <p className="text-slate-600">
          {form.targetScopes.includes('entire_platform')
            ? 'Entire platform'
            : form.targetScopes.join(', ').replace(/_/g, ' ')}
        </p>
        <p className="font-semibold text-slate-900 pt-2">Schedule</p>
        <p className="text-slate-600">
          {form.startDate} → {form.endDate} ({form.timezone})
        </p>
        {(form.usageLimit || form.usageLimitPerUser) && (
          <>
            <p className="font-semibold text-slate-900 pt-2">Usage limits</p>
            <p className="text-slate-600">
              {form.usageLimit ? `Total: ${form.usageLimit}` : ''}
              {form.usageLimitPerUser ? ` · Per customer: ${form.usageLimitPerUser}` : ''}
            </p>
          </>
        )}
        {form.minAmount ? (
          <>
            <p className="font-semibold text-slate-900 pt-2">Conditions</p>
            <p className="text-slate-600">Min order ₹{form.minAmount}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
