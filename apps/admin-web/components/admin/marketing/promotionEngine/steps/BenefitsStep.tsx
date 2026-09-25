'use client';

import { useEffect, useState } from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import type { PromoEngineBenefit, PromoEngineDraft } from '@/lib/promo-engine/types';
import { createEmptyVcf } from '@/lib/promo-engine/types';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import {
  inheritRedeemScopeFromAudience,
  normalizeRedeemMulti,
  resolveRedeemCategoryIds,
  resolveRedeemVendorIds,
} from '@/lib/promo-engine/vcf';

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

type VendorHit = { id: string; business_name?: string; businessName?: string; role_display_name?: string };

function RedeemVendorMulti({
  ids,
  names,
  onChange,
}: {
  ids: string[];
  names: string[];
  onChange: (ids: string[], names: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<VendorHit[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setHits([]);
        return;
      }
      void apiClient
        .get<{ vendors?: VendorHit[] }>(`/admin/vendors?q=${encodeURIComponent(query)}&limit=20`)
        .then((res) => setHits(Array.isArray(res.vendors) ? res.vendors : []))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-2">
      <Label>Vendors where cashback can be spent (multi)</Label>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[#FF8C42] bg-orange-50 px-3 py-1 text-sm text-[#FF8C42]"
            onClick={() => {
              onChange(
                ids.filter((x) => x !== id),
                names.filter((_, idx) => ids[idx] !== id)
              );
            }}
          >
            {names[i] || id}
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <Input
        value={q}
        placeholder="Search business name to add"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        className="min-h-11"
      />
      {hits.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border bg-white text-sm">
          {hits.map((v) => {
            const name = v.business_name || v.businessName || v.id;
            const already = ids.includes(v.id);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={already}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => {
                    onChange([...ids, v.id], [...names, name]);
                    setQ('');
                    setHits([]);
                  }}
                >
                  <span>{name}</span>
                  <span className="text-xs text-slate-500">{already ? 'Added' : v.role_display_name || ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
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
  const { categories, loading, error } = useCatalogServiceCategories();
  const discount = discountBenefit(draft.benefitJson);
  const cashback = cashbackBenefit(draft.benefitJson);
  const redeemVendorIds = resolveRedeemVendorIds(draft.vcf?.redeem);
  const redeemCategoryIds = resolveRedeemCategoryIds(draft.vcf?.redeem);

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
    draft.vcf?.visitSource.vendorId,
    draft.vcf?.visitSource.vendorName,
    draft.vcf?.visitSource.categoryId,
    draft.vcf?.visitSource.categoryName,
    draft.vcf?.publish.letter,
    draft.vcf?.publish.vendorId,
    draft.vcf?.publish.vendorName,
    draft.vcf?.publish.categoryId,
    draft.vcf?.publish.categoryName,
    draft.vcf?.redeem?.letter,
  ]);

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

  const patchRedeem = (
    patch: Partial<NonNullable<PromoEngineDraft['vcf']>['redeem']>
  ) => {
    const base = draft.vcf || createEmptyVcf();
    const redeem = normalizeRedeemMulti({
      letter: base.redeem?.letter || 'F',
      channels: base.redeem?.channels || ['tele', 'appointment', 'paybill', 'ecommerce'],
      ...base.redeem,
      ...patch,
    });
    onChange({ ...draft, vcf: { ...base, redeem } });
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
                  Same vendor / category seeds from Audience; add more so one promo covers multiple spend targets.
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
                        const base = draft.vcf || createEmptyVcf();
                        const inherited = inheritRedeemScopeFromAudience(base, letter);
                        patchRedeem({
                          letter,
                          channels: base.redeem?.channels || [
                            'tele',
                            'appointment',
                            'paybill',
                            'ecommerce',
                          ],
                          vendorId: undefined,
                          vendorIds: undefined,
                          vendorName: undefined,
                          vendorNames: undefined,
                          categoryId: undefined,
                          categoryIds: undefined,
                          categoryName: undefined,
                          categoryNames: undefined,
                          ...(letter === 'V' || letter === 'C' ? inherited : {}),
                        });
                      }}
                    >
                      {letter === 'V' ? 'Same vendor' : letter === 'C' ? 'Same category' : 'Anywhere'}
                    </button>
                  ))}
                </div>

                {draft.vcf?.redeem?.letter === 'C' ? (
                  <div className="space-y-2">
                    <Label>Categories where cashback can be spent (multi)</Label>
                    {loading ? (
                      <p className="text-xs text-slate-500">Loading catalogue…</p>
                    ) : error ? (
                      <p className="text-xs text-red-600">{error}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c) => {
                          const on = redeemCategoryIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`rounded-full border px-3 py-1.5 text-sm ${
                                on ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' : 'border-slate-200'
                              }`}
                              onClick={() => {
                                const nextIds = on
                                  ? redeemCategoryIds.filter((id) => id !== c.id)
                                  : [...redeemCategoryIds, c.id];
                                const nameById = new Map(
                                  categories.map((row) => [row.id, row.name] as const)
                                );
                                const prevNames = draft.vcf?.redeem?.categoryNames || [];
                                const nextNames = nextIds.map((id) => {
                                  if (id === c.id) return c.name;
                                  const prevIdx = redeemCategoryIds.indexOf(id);
                                  return (
                                    (prevIdx >= 0 ? prevNames[prevIdx] : undefined) ||
                                    nameById.get(id) ||
                                    id
                                  );
                                });
                                patchRedeem({
                                  letter: 'C',
                                  categoryIds: nextIds,
                                  categoryId: nextIds[0],
                                  categoryNames: nextNames,
                                  categoryName: nextNames[0],
                                });
                              }}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!redeemCategoryIds.length ? (
                      <p className="text-xs text-amber-700">
                        Pick at least one category (Audience seed appears after Visit/Publish = Category).
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {draft.vcf?.redeem?.letter === 'V' ? (
                  <div className="space-y-2">
                    <RedeemVendorMulti
                      ids={redeemVendorIds}
                      names={
                        draft.vcf.redeem.vendorNames?.length
                          ? draft.vcf.redeem.vendorNames
                          : redeemVendorIds.map((id) =>
                              id === draft.vcf?.redeem?.vendorId
                                ? draft.vcf.redeem.vendorName || id
                                : id
                            )
                      }
                      onChange={(ids, names) =>
                        patchRedeem({
                          letter: 'V',
                          vendorIds: ids,
                          vendorId: ids[0],
                          vendorNames: names,
                          vendorName: names[0],
                        })
                      }
                    />
                    {!redeemVendorIds.length ? (
                      <p className="text-xs text-amber-700">
                        Pick at least one vendor (Audience seed appears after Visit/Publish = Vendor).
                      </p>
                    ) : null}
                  </div>
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
                          patchRedeem({ channels: Array.from(set) });
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
            Use on{' '}
            {draft.vcf?.redeem?.letter === 'F'
              ? 'anywhere'
              : draft.vcf?.redeem?.letter === 'V'
                ? redeemVendorIds.length > 1
                  ? `${redeemVendorIds.length} vendors`
                  : 'selected vendor(s)'
                : redeemCategoryIds.length > 1
                  ? `${redeemCategoryIds.length} categories`
                  : 'selected category(ies)'}
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
