'use client';

import type { PromotionWizardForm, PromotionTargetCatalog } from '../types';
import { formatSmartTargetSummary, inferSmartFlowFromForm } from '../smart-target';

function row(label: string, value: string) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

export function PromotionSummary({
  form,
  catalog,
  smartSurface,
}: {
  form: PromotionWizardForm;
  catalog?: PromotionTargetCatalog;
  smartSurface?: 'marketing' | 'ecommerce';
}) {
  const discount =
    form.discountType === 'percentage'
      ? `${form.discountValue}%${form.maxDiscount ? ` (max ₹${form.maxDiscount})` : ''}`
      : `₹${form.discountValue}`;

  const targets = smartSurface
    ? formatSmartTargetSummary(form, smartSurface, catalog)
    : form.targetScopes.includes('entire_platform')
      ? 'Entire platform'
      : form.targetScopes
          .map((s) => {
            const n = form.selectedTargets[s]?.length ?? 0;
            return n > 0 ? `${n} ${s.replace(/_/g, ' ')}` : s.replace(/_/g, ' ');
          })
          .join(', ');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
      <h4 className="text-sm font-semibold text-slate-900 mb-2">Summary</h4>
      {row('Type', form.createKind === 'coupon' ? 'Coupon' : 'Promotion (auto-applied)')}
      {row('Name', form.name || '—')}
      {form.createKind === 'coupon' ? row('Code', form.code || '—') : null}
      {row('Offer', form.promotionType.replace(/_/g, ' '))}
      {row('Discount', discount)}
      {row('Audience', form.audience.replace(/_/g, ' '))}
      {row('Targets', targets || '—')}
      {form.minAmount ? row('Min amount', `₹${form.minAmount}`) : null}
      {form.usageLimit ? row('Usage limit', String(form.usageLimit)) : null}
      {row('Schedule', `${form.startDate} → ${form.endDate}`)}
      {row('Status', form.uiStatus)}
    </div>
  );
}

export function promotionTargetSummaryLabel(
  form: PromotionWizardForm,
  smartSurface?: 'marketing' | 'ecommerce',
  catalog?: PromotionTargetCatalog
): string {
  if (smartSurface) {
    return formatSmartTargetSummary(form, smartSurface, catalog);
  }
  if (form.targetScopes.includes('entire_platform')) return 'Entire platform';
  return inferSmartFlowFromForm(form, smartSurface ?? 'marketing');
}
