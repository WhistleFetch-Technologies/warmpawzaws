'use client';

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { labelsForCatalogSlugs } from '@/lib/promo-engine/catalog-categories';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import type { PromoEngineBenefit, PromoEngineDraft } from '@/lib/promo-engine/types';
import { ServiceCategoryChips } from '../ServiceCategoryChips';

function discountBenefit(list: PromoEngineBenefit[]): PromoEngineBenefit {
  return list.find((b) => b.type === 'DISCOUNT') || { type: 'DISCOUNT', mode: 'PERCENT', value: 0 };
}

function cashbackBenefit(list: PromoEngineBenefit[]): PromoEngineBenefit | null {
  return list.find((b) => b.type === 'CASHBACK') || null;
}

function rebuild(discount: PromoEngineBenefit, cashback: PromoEngineBenefit | null): PromoEngineBenefit[] {
  const out: PromoEngineBenefit[] = [];
  if ((discount.value ?? 0) > 0) out.push(discount);
  if (cashback && (cashback.value ?? 0) > 0) out.push(cashback);
  return out;
}

export function BenefitsStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const { categories, loading, error } = useCatalogServiceCategories();
  const discount = discountBenefit(draft.benefitJson);
  const cashback = cashbackBenefit(draft.benefitJson);
  const scope = new Set(cashback?.redeemScope || []);

  const setDiscount = (patch: Partial<PromoEngineBenefit>) => {
    const next = { ...discount, type: 'DISCOUNT' as const, ...patch };
    onChange({ ...draft, benefitJson: rebuild(next, cashback) });
  };

  const setCashback = (patch: Partial<PromoEngineBenefit> | null) => {
    if (patch === null) {
      onChange({ ...draft, benefitJson: rebuild(discount, null) });
      return;
    }
    const next: PromoEngineBenefit = {
      type: 'CASHBACK',
      mode: cashback?.mode || 'FIXED',
      value: cashback?.value ?? 0,
      expiryDays: cashback?.expiryDays ?? 30,
      redeemScope: cashback?.redeemScope || [],
      ...patch,
    };
    onChange({ ...draft, benefitJson: rebuild(discount, next) });
  };

  const toggleScope = (slug: string) => {
    const next = new Set(scope);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setCashback({ redeemScope: Array.from(next) });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="min-w-0 space-y-5">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">Discount</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Value type</Label>
              <Select
                value={discount.mode || 'PERCENT'}
                onValueChange={(v: string) => setDiscount({ mode: v as 'PERCENT' | 'FIXED' })}
              >
                <SelectTrigger className="min-h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed ₹</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                value={discount.value ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDiscount({ value: e.target.value === '' ? 0 : Number(e.target.value) })
                }
                className="min-h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Max discount ₹</Label>
              <Input
                type="number"
                min={0}
                value={discount.maxAmount ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDiscount({
                    maxAmount: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="min-h-11"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Cashback</h3>
            <button
              type="button"
              className="text-sm font-medium text-[#FF8C42] hover:underline"
              onClick={() =>
                cashback
                  ? setCashback(null)
                  : setCashback({ mode: 'FIXED', value: 150, expiryDays: 30 })
              }
            >
              {cashback ? 'Remove cashback' : '+ Add cashback'}
            </button>
          </div>
          {cashback ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Value type</Label>
                  <Select
                    value={cashback.mode || 'FIXED'}
                    onValueChange={(v: string) => setCashback({ mode: v as 'PERCENT' | 'FIXED' })}
                  >
                    <SelectTrigger className="min-h-11 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed ₹</SelectItem>
                      <SelectItem value="PERCENT">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cashback.value ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCashback({ value: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>Expires (days after earn)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cashback.expiryDays ?? 30}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCashback({ expiryDays: Number(e.target.value) || 30 })
                    }
                    className="min-h-11"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Can cashback be redeemed on?</Label>
                <ServiceCategoryChips
                  categories={categories}
                  selected={cashback.redeemScope || []}
                  loading={loading}
                  error={error}
                  onToggle={toggleScope}
                />
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Optional. Combine discount + cashback in one promotion.
            </p>
          )}
        </section>
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm xl:sticky xl:top-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer view</p>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-[#FF8C42]">Special offer</p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {(discount.value ?? 0) > 0
              ? discount.mode === 'FIXED'
                ? `₹${discount.value} off`
                : `${discount.value}% off`
              : 'No discount'}
            {discount.maxAmount ? ` · max ₹${discount.maxAmount}` : ''}
          </p>
          {cashback && (cashback.value ?? 0) > 0 ? (
            <p className="mt-2 text-sm text-emerald-700">
              Plus {cashback.mode === 'PERCENT' ? `${cashback.value}%` : `₹${cashback.value}`} cashback
            </p>
          ) : null}
          {cashback?.expiryDays ? (
            <p className="mt-1 text-xs text-slate-500">Cashback valid for {cashback.expiryDays} days</p>
          ) : null}
        </div>
        {cashback && (cashback.redeemScope?.length || 0) > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
            Use on {labelsForCatalogSlugs(cashback.redeemScope || [], categories)}
          </div>
        ) : null}
        <p className="text-xs leading-5 text-slate-500">
          Never credits wallet from this screen — only after commit.
        </p>
      </aside>
    </div>
  );
}
