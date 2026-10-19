'use client';

import { Label } from '@warmpawz/ui';
import type { PromoEngineDraft } from '@/lib/promo-engine/types';
import { createEmptyVcf } from '@/lib/promo-engine/types';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import {
  inheritRedeemScopeFromAudience,
  normalizeRedeemMulti,
  resolveRedeemCategoryIds,
  resolveRedeemVendorIds,
} from '@/lib/promo-engine/vcf';
import { CategoryMultiChips } from './CategoryMultiChips';
import { VendorMultiPicker } from './VendorMultiPicker';

const ALL_CHANNELS = ['tele', 'appointment', 'paybill', 'ecommerce'] as const;

/** Where earned cashback can be spent. Promotion-level: shared by every range. */
export function CashbackRedeemSection({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const { categories, loading, error } = useCatalogServiceCategories();
  const redeemVendorIds = resolveRedeemVendorIds(draft.vcf?.redeem);
  const redeemCategoryIds = resolveRedeemCategoryIds(draft.vcf?.redeem);

  const patchRedeem = (patch: Partial<NonNullable<PromoEngineDraft['vcf']>['redeem']>) => {
    const base = draft.vcf || createEmptyVcf();
    const redeem = normalizeRedeemMulti({
      letter: base.redeem?.letter || 'F',
      channels: base.redeem?.channels || [...ALL_CHANNELS],
      ...base.redeem,
      ...patch,
    });
    onChange({ ...draft, vcf: { ...base, redeem } });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <Label>Redeem cashback</Label>
      <p className="text-xs text-slate-500">
        Same vendor / category seeds from Audience; add more so one promo covers multiple spend targets.
        {draft.ranges?.length ? ' Applies to cashback from every range.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['V', 'C', 'F'] as const).map((letter) => (
          <button
            key={letter}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm ${
              (draft.vcf?.redeem?.letter || 'F') === letter ? 'border-[#FF8C42] bg-orange-50' : 'border-slate-200'
            }`}
            onClick={() => {
              const base = draft.vcf || createEmptyVcf();
              const inherited = inheritRedeemScopeFromAudience(base, letter);
              patchRedeem({
                letter,
                channels: base.redeem?.channels || [...ALL_CHANNELS],
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
          <CategoryMultiChips
            label="Categories where cashback can be spent (multi)"
            categories={categories}
            loading={loading}
            error={error}
            ids={redeemCategoryIds}
            names={draft.vcf?.redeem?.categoryNames || []}
            onChange={(ids, names) =>
              patchRedeem({
                letter: 'C',
                categoryIds: ids,
                categoryId: ids[0],
                categoryNames: names,
                categoryName: names[0],
              })
            }
          />
          {!redeemCategoryIds.length ? (
            <p className="text-xs text-amber-700">
              Pick at least one category (Audience seed appears after Visit/Publish = Category).
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.vcf?.redeem?.letter === 'V' ? (
        <div className="space-y-2">
          <VendorMultiPicker
            label="Vendors where cashback can be spent (multi)"
            ids={redeemVendorIds}
            names={
              draft.vcf.redeem.vendorNames?.length
                ? draft.vcf.redeem.vendorNames
                : redeemVendorIds.map((id) =>
                    id === draft.vcf?.redeem?.vendorId ? draft.vcf.redeem.vendorName || id : id
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
        {ALL_CHANNELS.map((ch) => {
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
    </section>
  );
}

export function redeemSummary(draft: PromoEngineDraft): string {
  const redeem = draft.vcf?.redeem;
  const vendors = resolveRedeemVendorIds(redeem).length;
  const cats = resolveRedeemCategoryIds(redeem).length;
  const where =
    redeem?.letter === 'F' || !redeem?.letter
      ? 'anywhere'
      : redeem.letter === 'V'
        ? vendors > 1
          ? `${vendors} vendors`
          : 'selected vendor(s)'
        : cats > 1
          ? `${cats} categories`
          : 'selected category(ies)';
  return `Use on ${where} · ${(redeem?.channels || []).join(', ')}`;
}
