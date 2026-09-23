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
import type { PromoEngineBenefit, PromoEngineDraft, PromoLetter } from '@/lib/promo-engine/types';
import { mapRedeemFromAudience, vcfOrEmpty } from '@/lib/promo-engine/vcf';

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

  const setDiscount = (patch: Partial<PromoEngineBenefit>) => {
    const next = { ...discount, type: 'DISCOUNT' as const, ...patch };
    onChange({ ...draft, benefitJson: rebuild(next, cashback) });
  };

  const setCashback = (patch: Partial<PromoEngineBenefit> | null) => {
    if (patch === null) {
      onChange({
        ...draft,
        benefitJson: rebuild(discount, null),
        vcf: draft.vcf ? { ...draft.vcf, benefitMode: 'discount' } : draft.vcf,
      });
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
    const hasDiscount = Number(discount.value) > 0;
    onChange({
      ...draft,
      benefitJson: rebuild(discount, next),
      vcf: draft.vcf
        ? {
            ...draft.vcf,
            benefitMode: hasDiscount ? 'both' : 'cashback',
            expiryDays: next.expiryDays,
          }
        : draft.vcf,
    });
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
                value={discount.maxAmount ?? draft.vcf?.maxDiscount ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const n = e.target.value === '' ? undefined : Number(e.target.value);
                  setDiscount({ maxAmount: n });
                  if (draft.vcf) {
                    onChange({
                      ...draft,
                      benefitJson: rebuild({ ...discount, maxAmount: n }, cashback),
                      vcf: { ...draft.vcf, maxDiscount: n },
                    });
                  }
                }}
                className="min-h-11"
              />
              <p className="text-xs text-slate-500">
                When discount and cashback are both on, this caps the two combined.
              </p>
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
                <Label>Redeem cashback</Label>
                <p className="text-xs text-slate-500">
                  Same vendor / same category uses the vendor or category already set on Publish
                  (or Visit source if Publish is platform).
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['V', 'C', 'F'] as const).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        (draft.vcf?.redeem?.letter || 'F') === letter
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-slate-200'
                      }`}
                      onClick={() => {
                        const audience = vcfOrEmpty(draft);
                        onChange({
                          ...draft,
                          vcf: {
                            ...audience,
                            redeem: mapRedeemFromAudience(audience, letter as PromoLetter),
                          },
                        });
                      }}
                    >
                      {letter === 'V' ? 'Same vendor' : letter === 'C' ? 'Same category' : 'Anywhere'}
                    </button>
                  ))}
                </div>
                {draft.vcf?.redeem?.letter === 'V' ? (
                  <p className="text-xs text-slate-600">
                    {draft.vcf.redeem.vendorName || draft.vcf.redeem.vendorId
                      ? `Mapped vendor: ${draft.vcf.redeem.vendorName || draft.vcf.redeem.vendorId}`
                      : 'Pick a vendor on Visit source or Publish first.'}
                  </p>
                ) : null}
                {draft.vcf?.redeem?.letter === 'C' ? (
                  <p className="text-xs text-slate-600">
                    {draft.vcf.redeem.categoryName || draft.vcf.redeem.categoryId
                      ? `Mapped category: ${draft.vcf.redeem.categoryName || draft.vcf.redeem.categoryId}`
                      : 'Pick a category on Visit source or Publish first.'}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {(['tele', 'appointment', 'paybill', 'ecommerce'] as const).map((ch) => {
                    const on = (draft.vcf?.redeem?.channels || []).includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-sm ${
                          on ? 'border-[#FF8C42] bg-orange-50' : 'border-slate-200'
                        }`}
                        onClick={() => {
                          const set = new Set(draft.vcf?.redeem?.channels || []);
                          if (set.has(ch)) set.delete(ch);
                          else set.add(ch);
                          const audience = vcfOrEmpty(draft);
                          onChange({
                            ...draft,
                            vcf: {
                              ...audience,
                              redeem: {
                                ...mapRedeemFromAudience(
                                  audience,
                                  (audience.redeem?.letter || 'F') as PromoLetter
                                ),
                                channels: Array.from(set),
                              },
                            },
                          });
                        }}
                      >
                        {ch === 'paybill' ? 'Pay Bill' : ch}
                      </button>
                    );
                  })}
                </div>
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
        {cashback && (draft.vcf?.redeem?.channels?.length || 0) > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
            Use on {draft.vcf?.redeem?.letter === 'F' ? 'anywhere' : draft.vcf?.redeem?.letter === 'V' ? 'this vendor' : 'this category'}
            {' · '}
            {(draft.vcf?.redeem?.channels || []).join(', ')}
          </div>
        ) : null}
        <p className="text-xs leading-5 text-slate-500">
          Never credits wallet from this screen — only after commit.
        </p>
      </aside>
    </div>
  );
}
