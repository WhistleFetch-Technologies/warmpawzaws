/**
 * Admin mirror of backend walk-in Store cashback redeem lock.
 * Keep in sync with:
 * backend/lambda/src/discount-engine/promo-engine/vcf/pet-store-walkin-redeem.ts
 */
import type { PromoEngineDraft, PromoVcfDraft } from './types';

export const PET_STORE_WALKIN_ROLE = 'pet_store_walkin';
export const PET_STORE_CATEGORY_SLUG = 'store';
export const WALKIN_CASHBACK_CHANNELS: NonNullable<PromoVcfDraft['redeem']>['channels'] = [
  'paybill',
];

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function uniqIds(raw: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function scopeIdsForLetter(
  scope: Record<string, unknown> | undefined,
  letter: 'V' | 'C'
): string[] {
  const s = asRecord(scope);
  if (String(s.letter || '').toUpperCase() !== letter) return [];
  if (letter === 'V') {
    return uniqIds([
      ...(Array.isArray(s.vendorIds) ? (s.vendorIds as unknown[]).map(String) : []),
      s.vendorId ? String(s.vendorId) : '',
    ]);
  }
  return uniqIds([
    ...(Array.isArray(s.categoryIds) ? (s.categoryIds as unknown[]).map(String) : []),
    s.categoryId ? String(s.categoryId) : '',
  ]);
}

export function isPetStoreWalkinCategorySlug(raw: unknown): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key === PET_STORE_CATEGORY_SLUG || key === PET_STORE_WALKIN_ROLE;
}

export function redeemNeedsWalkinLock(redeem: unknown): boolean {
  const r = asRecord(redeem);
  const letter = String(r.letter || 'F').toUpperCase();
  if (!letter || letter === 'F') return true;
  if (letter === 'C') return scopeIdsForLetter({ ...r, letter: 'C' }, 'C').length === 0;
  if (letter === 'V') return scopeIdsForLetter({ ...r, letter: 'V' }, 'V').length === 0;
  return false;
}

export function serviceCategoriesIncludeStore(serviceCategories?: string[] | null): boolean {
  return (serviceCategories || []).some((raw) => isPetStoreWalkinCategorySlug(raw));
}

export function isPetStoreWalkinPromoAudience(opts: {
  vcf: Record<string, unknown>;
  storeCategoryIds: string[];
  serviceCategories?: string[] | null;
  publishVendorsAreWalkin?: boolean;
}): boolean {
  if (serviceCategoriesIncludeStore(opts.serviceCategories)) return true;
  const storeSet = new Set(opts.storeCategoryIds.map(String));
  if (!storeSet.size && !opts.publishVendorsAreWalkin) return false;

  const publish = asRecord(opts.vcf.publish);
  const visit = asRecord(opts.vcf.visitSource);
  if (scopeIdsForLetter(publish, 'C').some((id) => storeSet.has(id))) return true;
  if (scopeIdsForLetter(visit, 'C').some((id) => storeSet.has(id))) return true;
  if (
    opts.publishVendorsAreWalkin &&
    String(publish.letter || '').toUpperCase() === 'V' &&
    scopeIdsForLetter(publish, 'V').length > 0
  ) {
    return true;
  }
  return false;
}

export function lockPetStoreWalkinCashbackRedeem(opts: {
  vcf: Record<string, unknown>;
  hasCashback: boolean;
  storeCategoryIds: string[];
  serviceCategories?: string[] | null;
  publishVendorsAreWalkin?: boolean;
}): Record<string, unknown> {
  if (!opts.hasCashback) return opts.vcf;
  if (!isPetStoreWalkinPromoAudience(opts)) return opts.vcf;
  if (!redeemNeedsWalkinLock(opts.vcf.redeem)) return opts.vcf;

  const publish = asRecord(opts.vcf.publish);
  const visit = asRecord(opts.vcf.visitSource);
  const storeSet = new Set(opts.storeCategoryIds.map(String));
  const channels = [...WALKIN_CASHBACK_CHANNELS];

  if (opts.publishVendorsAreWalkin && String(publish.letter || '').toUpperCase() === 'V') {
    const vendorIds = scopeIdsForLetter(publish, 'V');
    if (vendorIds.length) {
      return {
        ...opts.vcf,
        redeem: {
          letter: 'V',
          vendorIds,
          vendorId: vendorIds[0],
          channels,
        },
      };
    }
  }

  const fromPublish = scopeIdsForLetter(publish, 'C').filter((id) => storeSet.has(id));
  const fromVisit = scopeIdsForLetter(visit, 'C').filter((id) => storeSet.has(id));
  const categoryIds = fromPublish.length
    ? fromPublish
    : fromVisit.length
      ? fromVisit
      : [...storeSet];
  if (!categoryIds.length) return opts.vcf;

  return {
    ...opts.vcf,
    redeem: {
      letter: 'C',
      categoryIds,
      categoryId: categoryIds[0],
      channels,
    },
  };
}

/** Apply walk-in Store cashback redeem lock onto an admin draft when cashback is on. */
export function ensureDraftWalkinCashbackRedeem(
  draft: PromoEngineDraft,
  storeCategoryIds: string[],
  opts?: { publishVendorsAreWalkin?: boolean }
): PromoEngineDraft {
  if (!draft.vcf) return draft;
  const hasCashback =
    draft.vcf.benefitMode === 'cashback' ||
    draft.vcf.benefitMode === 'both' ||
    (draft.benefitJson || []).some(
      (b) => b.type === 'CASHBACK' && Number(b.value) > 0
    ) ||
    (draft.ranges || []).some((r) =>
      (r.benefitJson || []).some((b) => b.type === 'CASHBACK' && Number(b.value) > 0)
    );
  if (!hasCashback) return draft;

  const nextVcf = lockPetStoreWalkinCashbackRedeem({
    vcf: draft.vcf as unknown as Record<string, unknown>,
    hasCashback,
    storeCategoryIds,
    serviceCategories: draft.basics?.serviceCategories,
    publishVendorsAreWalkin: opts?.publishVendorsAreWalkin,
  });
  if (nextVcf === (draft.vcf as unknown as Record<string, unknown>)) return draft;
  const redeem = nextVcf.redeem as PromoVcfDraft['redeem'];
  if (!redeem) return draft;
  if (
    redeem.letter === draft.vcf.redeem?.letter &&
    JSON.stringify(redeem.categoryIds || []) ===
      JSON.stringify(draft.vcf.redeem?.categoryIds || []) &&
    JSON.stringify(redeem.vendorIds || []) === JSON.stringify(draft.vcf.redeem?.vendorIds || []) &&
    JSON.stringify(redeem.channels || []) === JSON.stringify(draft.vcf.redeem?.channels || [])
  ) {
    return draft;
  }
  return { ...draft, vcf: { ...draft.vcf, redeem } };
}
