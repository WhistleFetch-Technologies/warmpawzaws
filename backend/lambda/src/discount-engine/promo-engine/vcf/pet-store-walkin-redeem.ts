/**
 * Pet Store walk-in cashback must redeem only at walk-in Store vendors (Pay Bill),
 * never as Anywhere (F) that leaks to vet/grooming/ecommerce sellers.
 */
import { normalizePromoCategory } from '../dsl/category-aliases';

export const PET_STORE_WALKIN_ROLE = 'pet_store_walkin';
export const PET_STORE_CATEGORY_SLUG = 'store';
export const WALKIN_CASHBACK_CHANNELS = ['paybill'] as const;

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

/** True when redeem is Anywhere or Same vendor/category with no ids yet. */
export function redeemNeedsWalkinLock(redeem: unknown): boolean {
  const r = asRecord(redeem);
  const letter = String(r.letter || 'F').toUpperCase();
  if (!letter || letter === 'F') return true;
  if (letter === 'C') return scopeIdsForLetter({ ...r, letter: 'C' }, 'C').length === 0;
  if (letter === 'V') return scopeIdsForLetter({ ...r, letter: 'V' }, 'V').length === 0;
  return false;
}

export function serviceCategoriesIncludeStore(serviceCategories?: string[] | null): boolean {
  return (serviceCategories || []).some((raw) => {
    const normalized = normalizePromoCategory(raw) || String(raw).trim().toLowerCase();
    return isPetStoreWalkinCategorySlug(normalized);
  });
}

export function isPetStoreWalkinPromoAudience(opts: {
  vcf: Record<string, unknown>;
  storeCategoryIds: string[];
  serviceCategories?: string[] | null;
  /** Caller verified publish vendors are all pet_store_walkin. */
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

/**
 * When cashback is on for a walk-in Store promo and redeem is still Anywhere (or empty),
 * lock redeem to Store category (or those walk-in vendors) on Pay Bill only.
 */
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

export function payloadHasCashbackBenefit(opts: {
  benefitJson?: Array<{ type?: string; value?: unknown }> | null;
  ranges?: Array<{ benefit_json?: Array<{ type?: string; value?: unknown }> }> | null;
  benefitMode?: string | null;
}): boolean {
  const mode = String(opts.benefitMode || '').toLowerCase();
  if (mode === 'cashback' || mode === 'both') return true;
  const listHas = (list?: Array<{ type?: string; value?: unknown }> | null) =>
    (list || []).some(
      (b) => String(b.type || '').toUpperCase() === 'CASHBACK' && Number(b.value) > 0
    );
  if (listHas(opts.benefitJson)) return true;
  return (opts.ranges || []).some((r) => listHas(r.benefit_json));
}

/** True when this payment/earn happened at a pet_store_walkin / Store catalogue vendor. */
export function isEarnedAtPetStoreWalkin(opts: {
  storeCategoryIds: string[];
  paymentCategoryId?: string | null;
  paymentRoleName?: string | null;
  paymentRoleId?: string | null;
  paymentServiceCategory?: string | null;
}): boolean {
  const storeSet = new Set(opts.storeCategoryIds.map(String));
  if (opts.paymentCategoryId && storeSet.has(String(opts.paymentCategoryId))) return true;
  if (isPetStoreWalkinCategorySlug(opts.paymentRoleName)) return true;
  if (isPetStoreWalkinCategorySlug(opts.paymentRoleId)) return true;
  if (isPetStoreWalkinCategorySlug(opts.paymentServiceCategory)) return true;
  return false;
}

/**
 * Platform ladders often keep redeem = Anywhere (F). When cashback is *earned* on a
 * walk-in Store Pay Bill, lock that credit to the **same vendor** + paybill only
 * (not every walk-in store, and not vet/grooming/shop).
 */
export function lockRedeemScopeWhenEarnedAtWalkinStore(opts: {
  redeemScope: unknown;
  storeCategoryIds: string[];
  paymentVendorId?: string | null;
  paymentCategoryId?: string | null;
  paymentRoleName?: string | null;
  paymentRoleId?: string | null;
  paymentServiceCategory?: string | null;
}): unknown {
  if (!isEarnedAtPetStoreWalkin(opts)) return opts.redeemScope;
  const vendorId = String(opts.paymentVendorId || '').trim();
  if (vendorId) {
    return {
      letter: 'V',
      vendorId,
      vendorIds: [vendorId],
      channels: [...WALKIN_CASHBACK_CHANNELS],
    };
  }
  // No vendor on the payment — fall back to Store category + paybill.
  if (!redeemNeedsWalkinLock(opts.redeemScope)) return opts.redeemScope;
  const categoryIds = [...new Set(opts.storeCategoryIds.map(String).filter(Boolean))];
  if (!categoryIds.length) return opts.redeemScope;
  return {
    letter: 'C',
    categoryIds,
    categoryId: categoryIds[0],
    channels: [...WALKIN_CASHBACK_CHANNELS],
  };
}
