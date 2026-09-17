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
import { SERVICE_CATEGORIES, type PromoEngineBenefit, type PromoEngineDraft, type ServiceCategory } from '@/lib/promo-engine/types';

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
      redeemScope: cashback?.redeemScope || ['VET', 'TRAINING', 'BOARDING', 'ECOMMERCE'],
      ...patch,
    };
    onChange({ ...draft, benefitJson: rebuild(discount, next) });
  };

  const toggleScope = (cat: ServiceCategory) => {
    const next = new Set(scope);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setCashback({ redeemScope: Array.from(next) as ServiceCategory[] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Discount</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Value type</Label>
              <Select
                value={discount.mode || 'PERCENT'}
                onValueChange={(v: string) => setDiscount({ mode: v as 'PERCENT' | 'FIXED' })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed ₹</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                value={discount.value ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDiscount({ value: e.target.value === '' ? 0 : Number(e.target.value) })
                }
              />
            </div>
            <div>
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
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Cashback</h3>
            <button
              type="button"
              className="text-xs font-medium text-[#FF8C42] hover:underline"
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Value type</Label>
                  <Select
                    value={cashback.mode || 'FIXED'}
                    onValueChange={(v: string) => setCashback({ mode: v as 'PERCENT' | 'FIXED' })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed ₹</SelectItem>
                      <SelectItem value="PERCENT">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cashback.value ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCashback({ value: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Expires (days after earn)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cashback.expiryDays ?? 30}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCashback({ expiryDays: Number(e.target.value) || 30 })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Can cashback be redeemed on?</Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_CATEGORIES.map((cat) => {
                    const on = scope.has(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleScope(cat)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          on
                            ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Optional. Combine discount + cashback in one promotion.</p>
          )}
        </section>
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer view</p>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold text-[#FF8C42]">SPECIAL OFFER</p>
          <p className="mt-1 font-semibold text-slate-900">
            {(discount.value ?? 0) > 0
              ? discount.mode === 'FIXED'
                ? `₹${discount.value} off`
                : `${discount.value}% off`
              : 'No discount'}
            {discount.maxAmount ? ` · max ₹${discount.maxAmount}` : ''}
          </p>
          {cashback && (cashback.value ?? 0) > 0 ? (
            <p className="mt-1 text-sm text-emerald-700">
              Plus {cashback.mode === 'PERCENT' ? `${cashback.value}%` : `₹${cashback.value}`} cashback
            </p>
          ) : null}
          {cashback?.expiryDays ? (
            <p className="mt-1 text-xs text-slate-500">Cashback valid for {cashback.expiryDays} days</p>
          ) : null}
        </div>
        {cashback && (cashback.redeemScope?.length || 0) > 0 ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900">
            Use on {(cashback.redeemScope || []).join(', ')}
          </div>
        ) : null}
        <p className="text-[11px] text-slate-500">Never credits wallet from this screen — only after commit.</p>
      </aside>
    </div>
  );
}
