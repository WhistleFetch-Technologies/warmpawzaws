'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { PromoEngineBenefit, PromoEngineDraft, PromoRangeDraft } from '@/lib/promo-engine/types';
import {
  MAX_RANGES,
  appendRange,
  benefitModeOf,
  buildBenefits,
  cashbackOf,
  describeRangeBenefits,
  discountOf,
  rangeBoundsLabel,
  rangeFromSingle,
  rangeWarnings,
  removeRange,
  sortedRanges,
  updateRange,
  validateRangesDraft,
} from '@/lib/promo-engine/ranges';
import {
  inheritRedeemScopeFromAudience,
  normalizeRedeemMulti,
  resolveRedeemCategoryIds,
  resolveRedeemVendorIds,
  resolveScopeCategoryIds,
  resolveScopeVendorIds,
} from '@/lib/promo-engine/vcf';
import { BenefitValueFields } from './BenefitValueFields';
import { CashbackRedeemSection, redeemSummary } from './CashbackRedeemSection';
import { RangeCard } from './RangeCard';

function offerHeadline(list: PromoEngineBenefit[]): string {
  const d = discountOf(list);
  if (!(Number(d.value) > 0)) return 'No discount';
  const v = d.mode === 'PERCENT' ? `${d.value}% off` : `₹${d.value} off`;
  return d.maxAmount ? `${v} · max ₹${d.maxAmount}` : v;
}

function CustomerOffer({ benefits, caption }: { benefits: PromoEngineBenefit[]; caption?: string }) {
  const cashback = cashbackOf(benefits);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-[#FF8C42]">{caption || 'Special offer'}</p>
      <p className="mt-2 text-base font-semibold text-slate-900">{offerHeadline(benefits)}</p>
      {cashback && Number(cashback.value) > 0 ? (
        <p className="mt-2 text-sm text-emerald-700">
          Plus {cashback.mode === 'PERCENT' ? `${cashback.value}%` : `₹${cashback.value}`} cashback
          {cashback.maxAmount && cashback.mode === 'PERCENT' ? ` (max ₹${cashback.maxAmount})` : ''}
        </p>
      ) : null}
      {cashback?.expiryDays ? (
        <p className="mt-1 text-xs text-slate-500">Cashback valid for {cashback.expiryDays} days</p>
      ) : null}
    </div>
  );
}

export function BenefitsStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const ranges = draft.ranges || [];
  const ranged = ranges.length > 0;
  const [expandedKey, setExpandedKey] = useState<string | null>(ranges[0]?.key ?? null);
  const discount = discountOf(draft.benefitJson);
  const cashback = cashbackOf(draft.benefitJson);

  // Seed Same vendor/category from Audience only when redeem lists are still empty.
  useEffect(() => {
    const vcf = draft.vcf;
    if (!vcf?.redeem) return;
    const letter = vcf.redeem.letter;
    if (letter !== 'V' && letter !== 'C') return;
    if (letter === 'V' && resolveRedeemVendorIds(vcf.redeem).length) return;
    if (letter === 'C' && resolveRedeemCategoryIds(vcf.redeem).length) return;
    const inherited = inheritRedeemScopeFromAudience(vcf, letter);
    if (letter === 'V' && !inherited.vendorId) return;
    if (letter === 'C' && !inherited.categoryId) return;
    onChange({
      ...draft,
      vcf: {
        ...vcf,
        redeem: normalizeRedeemMulti({
          ...vcf.redeem,
          letter,
          ...inherited,
        }),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from Audience when redeem empty
  }, [
    draft.vcf?.visitSource.letter,
    resolveScopeVendorIds(draft.vcf?.visitSource).join(','),
    resolveScopeCategoryIds(draft.vcf?.visitSource).join(','),
    draft.vcf?.publish.letter,
    resolveScopeVendorIds(draft.vcf?.publish).join(','),
    resolveScopeCategoryIds(draft.vcf?.publish).join(','),
    draft.vcf?.redeem?.letter,
  ]);

  const setSingle = (d: PromoEngineBenefit, c: PromoEngineBenefit | null, maxDiscountChanged = false) => {
    const benefitJson = buildBenefits(d, c);
    const mode = benefitModeOf(benefitJson);
    onChange({
      ...draft,
      benefitJson,
      vcf: draft.vcf
        ? {
            ...draft.vcf,
            ...(mode ? { benefitMode: mode } : {}),
            ...(c ? { expiryDays: c.expiryDays } : {}),
            ...(maxDiscountChanged ? { maxDiscount: d.maxAmount } : {}),
          }
        : draft.vcf,
    });
  };

  const setRanges = (next: PromoRangeDraft[]) => onChange({ ...draft, ranges: next });

  const addRange = () => {
    const promoCap = draft.vcf?.maxDiscount;
    const carried = draft.benefitJson.map((b) =>
      b.type === 'DISCOUNT' && b.maxAmount == null && promoCap != null ? { ...b, maxAmount: promoCap } : b
    );
    const base = ranged ? ranges : [rangeFromSingle(carried)];
    const next = appendRange(base);
    setExpandedKey(next[next.length - 1].key);
    setRanges(next);
  };

  const sorted = sortedRanges(ranges);
  const errors = validateRangesDraft(ranges);
  const warnings = rangeWarnings(ranges, draft.limits?.budgetLimit);
  const anyCashback = ranged
    ? ranges.some((r) => cashbackOf(r.benefitJson) !== null)
    : cashback !== null;
  const previewRange = sorted.find((r) => r.key === expandedKey) || sorted[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="min-w-0 space-y-5">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Value ranges and benefits</h3>
              <p className="text-sm text-slate-500">
                {ranged
                  ? 'Each bill matches one range; a bill exactly on a shared boundary uses the lower range.'
                  : 'If no range is added, the values below apply to all orders.'}
              </p>
            </div>
            <button
              type="button"
              disabled={ranges.length >= MAX_RANGES}
              className="inline-flex items-center gap-1 rounded-lg border border-[#FF8C42] px-3 py-2 text-sm font-medium text-[#C2410C] hover:bg-orange-50 disabled:opacity-50"
              onClick={addRange}
            >
              <Plus className="h-4 w-4" /> New range
            </button>
          </div>

          {ranged ? (
            <div className="space-y-3">
              {sorted.map((r, i) => (
                <RangeCard
                  key={r.key}
                  range={r}
                  index={i}
                  prev={sorted[i - 1]}
                  expanded={expandedKey === r.key}
                  onToggle={() => setExpandedKey(expandedKey === r.key ? null : r.key)}
                  onChange={(patch) => setRanges(updateRange(ranges, r.key, patch))}
                  onRemove={() => onChange(removeRange(draft, r.key))}
                />
              ))}
            </div>
          ) : (
            <BenefitValueFields
              discount={discount}
              cashback={cashback}
              maxDiscountFallback={draft.vcf?.maxDiscount}
              onDiscount={(patch) =>
                setSingle({ ...discount, type: 'DISCOUNT', ...patch }, cashback, 'maxAmount' in patch)
              }
              onCashback={(patch) =>
                setSingle(
                  discount,
                  patch === null
                    ? null
                    : {
                        type: 'CASHBACK',
                        mode: cashback?.mode || 'FIXED',
                        value: cashback?.value ?? 0,
                        expiryDays: cashback?.expiryDays ?? 30,
                        redeemScope: cashback?.redeemScope || [],
                        ...cashback,
                        ...patch,
                      },
                )
              }
            />
          )}

          {errors.length ? (
            <ul className="space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length ? (
            <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {anyCashback ? <CashbackRedeemSection draft={draft} onChange={onChange} /> : null}
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm xl:sticky xl:top-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer view</p>
        {ranged && previewRange ? (
          <>
            <CustomerOffer
              benefits={previewRange.benefitJson}
              caption={`Special offer · bills ${rangeBoundsLabel(previewRange)}`}
            />
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">All ranges</p>
              {sorted.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setExpandedKey(r.key)}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                    r.key === previewRange.key ? 'bg-orange-50' : 'hover:bg-slate-50'
                  } ${r.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}
                >
                  <span className="font-medium">{rangeBoundsLabel(r)}</span> · {describeRangeBenefits(r.benefitJson)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <CustomerOffer benefits={draft.benefitJson} />
        )}
        {anyCashback && (draft.vcf?.redeem?.channels?.length || 0) > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
            {redeemSummary(draft)}
          </div>
        ) : null}
        <p className="text-xs leading-5 text-slate-500">
          Never credits wallet from this screen — only after commit.
        </p>
      </aside>
    </div>
  );
}
