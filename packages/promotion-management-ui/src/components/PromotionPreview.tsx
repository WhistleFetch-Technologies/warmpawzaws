'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Ticket } from 'lucide-react';
import type {
  PromotionTargetCatalog,
  PromotionWizardForm,
  SmartTargetCatalogAdapter,
} from '../types';
import {
  collectSelectedTargetOptions,
  estimateDiscountedPrice,
  formatInr,
  mergeCatalogWithResolvedOptions,
  resolveLazySelectedOptions,
  selectedPreviewFooter,
  selectedPreviewSectionTitle,
  supportsSimplePricePreview,
} from '../preview-discount';

/** UI-only preview from wizard values — no backend simulation. */
export function PromotionPreview({
  form,
  catalog,
  smartTargetAdapter,
  showSelectedPricing = true,
}: {
  form: PromotionWizardForm;
  catalog?: PromotionTargetCatalog;
  smartTargetAdapter?: SmartTargetCatalogAdapter;
  showSelectedPricing?: boolean;
}) {
  const [previewCatalog, setPreviewCatalog] = useState<PromotionTargetCatalog | undefined>(catalog);

  useEffect(() => {
    let cancelled = false;

    const syncCatalog = async () => {
      if (!catalog) {
        setPreviewCatalog(undefined);
        return;
      }
      if (!smartTargetAdapter) {
        setPreviewCatalog(catalog);
        return;
      }

      const resolved = await resolveLazySelectedOptions(form, catalog, smartTargetAdapter);
      if (!cancelled) {
        setPreviewCatalog(mergeCatalogWithResolvedOptions(catalog, resolved));
      }
    };

    void syncCatalog();
    return () => {
      cancelled = true;
    };
  }, [catalog, smartTargetAdapter, form.selectedTargets, form.targetScopes]);

  const isCoupon = form.createKind === 'coupon';
  const headline = isCoupon
    ? form.code || 'COUPON_CODE'
    : form.name || 'Your promotion';
  const savings =
    form.discountType === 'percentage'
      ? `${form.discountValue}% OFF`
      : `₹${form.discountValue} OFF`;

  const selectedItems = useMemo(
    () => collectSelectedTargetOptions(form, previewCatalog),
    [form, previewCatalog]
  );

  const canPreviewPrices = supportsSimplePricePreview(form.promotionType);

  const heroPrice =
    selectedItems.find((item) => item.price != null && item.price > 0)?.price ?? 899;

  const heroEstimated = estimateDiscountedPrice(heroPrice, form);

  const showSelectedSection =
    showSelectedPricing && previewCatalog != null && selectedItems.length > 0;

  return (
    <div className="space-y-4">
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
              <span className="text-sm text-slate-400 line-through">{formatInr(heroPrice)}</span>
              <span className="text-lg font-bold text-orange-600">{formatInr(heroEstimated)}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {selectedItems.some((i) => i.price != null)
                ? 'Based on your selected inventory — final price depends on cart'
                : 'Illustrative — actual price depends on cart'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-2">
          <p className="font-semibold text-slate-900">Applicable to</p>
          <p className="text-slate-600">
            {form.targetScopes.includes('all_products')
              ? 'All Products'
              : form.targetScopes.includes('entire_platform')
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

      {showSelectedSection ? (
        <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-3">
            {selectedPreviewSectionTitle(selectedItems)}
          </p>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-white bg-white shadow-sm divide-y divide-slate-50">
            {selectedItems.map((item) => {
              const hasPrice = item.price != null && item.price > 0;
              const discounted =
                hasPrice && canPreviewPrices
                  ? estimateDiscountedPrice(item.price!, form)
                  : undefined;

              return (
                <div
                  key={`${item.scope}:${item.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {item.label}
                  </p>
                  {hasPrice && canPreviewPrices && discounted != null ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm text-slate-400 line-through">
                        {formatInr(item.price!)}
                      </span>
                      <span className="text-sm font-bold text-orange-600">
                        {formatInr(discounted)}
                      </span>
                    </div>
                  ) : hasPrice && !canPreviewPrices ? (
                    <span className="shrink-0 text-xs text-slate-500">
                      Price preview not available for this offer type
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">Price not set</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {canPreviewPrices
              ? selectedPreviewFooter(selectedItems, form)
              : 'Price preview available for percentage and flat discounts only'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
