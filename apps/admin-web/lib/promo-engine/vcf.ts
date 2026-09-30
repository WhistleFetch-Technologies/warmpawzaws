import type { PromoAudienceScope, PromoEngineDraft, PromoLetter, PromoVcfDraft } from './types';
import { createEmptyVcf } from './types';

export type ScopeEntries = { ids: string[]; names: string[] };

function uniqStrings(ids: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function resolveRedeemVendorIds(
  redeem: PromoVcfDraft['redeem'] | undefined
): string[] {
  if (!redeem) return [];
  return uniqStrings([...(redeem.vendorIds || []), redeem.vendorId]);
}

export function resolveRedeemCategoryIds(
  redeem: PromoVcfDraft['redeem'] | undefined
): string[] {
  if (!redeem) return [];
  return uniqStrings([...(redeem.categoryIds || []), redeem.categoryId]);
}

/**
 * Selected vendors (V) or categories (C) of an audience scope, with names aligned by index.
 * Older drafts with only the singular id read as a list of one.
 */
export function audienceScopeEntries(
  scope: PromoAudienceScope | undefined,
  letter: 'V' | 'C'
): ScopeEntries {
  if (!scope || scope.letter !== letter) return { ids: [], names: [] };
  const listIds = letter === 'V' ? scope.vendorIds : scope.categoryIds;
  const listNames = letter === 'V' ? scope.vendorNames : scope.categoryNames;
  const singleId = String((letter === 'V' ? scope.vendorId : scope.categoryId) || '').trim();
  const singleName = letter === 'V' ? scope.vendorName : scope.categoryName;
  const ids: string[] = [];
  const names: string[] = [];
  (listIds || []).forEach((raw, i) => {
    const id = String(raw || '').trim();
    if (!id || ids.includes(id)) return;
    ids.push(id);
    names.push(listNames?.[i] || (id === singleId ? singleName : undefined) || id);
  });
  if (singleId && !ids.includes(singleId)) {
    ids.push(singleId);
    names.push(singleName || singleId);
  }
  return { ids, names };
}

export function resolveScopeVendorIds(scope: PromoAudienceScope | undefined): string[] {
  return audienceScopeEntries(scope, 'V').ids;
}

export function resolveScopeCategoryIds(scope: PromoAudienceScope | undefined): string[] {
  return audienceScopeEntries(scope, 'C').ids;
}

/** Replace the vendor (V) or category (C) list; singular id/name follow the first entry. */
export function withScopeList<T extends PromoAudienceScope>(
  scope: T,
  letter: 'V' | 'C',
  entries: ScopeEntries
): T {
  const has = entries.ids.length > 0;
  if (letter === 'V') {
    return {
      ...scope,
      vendorIds: has ? entries.ids : undefined,
      vendorNames: has ? entries.ids.map((id, i) => entries.names[i] || id) : undefined,
      vendorId: entries.ids[0],
      vendorName: has ? entries.names[0] || entries.ids[0] : undefined,
    };
  }
  return {
    ...scope,
    categoryIds: has ? entries.ids : undefined,
    categoryNames: has ? entries.ids.map((id, i) => entries.names[i] || id) : undefined,
    categoryId: entries.ids[0],
    categoryName: has ? entries.names[0] || entries.ids[0] : undefined,
  };
}

/** Keep lists and singular fields in sync; clear ids that do not belong to the letter. */
export function normalizeScopeMulti<T extends PromoAudienceScope>(scope: T): T {
  const cleared: T = {
    ...scope,
    vendorId: undefined,
    vendorName: undefined,
    vendorIds: undefined,
    vendorNames: undefined,
    categoryId: undefined,
    categoryName: undefined,
    categoryIds: undefined,
    categoryNames: undefined,
  };
  if (scope.letter === 'V') return withScopeList(cleared, 'V', audienceScopeEntries(scope, 'V'));
  if (scope.letter === 'C') return withScopeList(cleared, 'C', audienceScopeEntries(scope, 'C'));
  return cleared;
}

/** e.g. "C (Vet Care, Grooming)" or "F". */
export function describeAudienceScope(scope: PromoAudienceScope): string {
  if (scope.letter !== 'V' && scope.letter !== 'C') return scope.letter;
  const { names } = audienceScopeEntries(scope, scope.letter);
  return names.length ? `${scope.letter} (${names.join(', ')})` : scope.letter;
}

export type VisitChannelLock = 'none' | 'ecommerce_only' | 'ecommerce_required';

/**
 * A Pet Shop (ecommerce) visit-source category only has ecommerce visits:
 * only ecommerce categories → channels locked to ecommerce; mixed with service
 * categories → ecommerce stays on, other channels remain optional.
 */
export function visitChannelLock(
  visitSource: PromoVcfDraft['visitSource'],
  categories: Array<{ id: string; isEcommerce?: boolean }>
): VisitChannelLock {
  if (visitSource.letter !== 'C') return 'none';
  const ids = audienceScopeEntries(visitSource, 'C').ids;
  if (!ids.length) return 'none';
  const ecommerceIds = new Set(categories.filter((c) => c.isEcommerce).map((c) => c.id));
  const ecomCount = ids.filter((id) => ecommerceIds.has(id)).length;
  if (!ecomCount) return 'none';
  return ecomCount === ids.length ? 'ecommerce_only' : 'ecommerce_required';
}

export function applyVisitChannelLock(
  visitSource: PromoVcfDraft['visitSource'],
  lock: VisitChannelLock
): PromoVcfDraft['visitSource'] {
  if (lock === 'ecommerce_only') {
    return { ...visitSource, width: 'specific', channels: ['ecommerce'] };
  }
  if (lock === 'ecommerce_required') {
    const current = visitSource.width === 'specific' ? visitSource.channels || [] : [];
    const base = current.length ? current : (['tele', 'appointment', 'paybill'] as const);
    const channels = Array.from(new Set([...base, 'ecommerce' as const]));
    return { ...visitSource, width: 'specific', channels };
  }
  return visitSource;
}

/** Normalize visit source + publish lists and stamp pooled counting. */
export function normalizeVcfAudience(vcf: PromoVcfDraft): PromoVcfDraft {
  return {
    ...vcf,
    visitSource: { ...normalizeScopeMulti(vcf.visitSource), countMode: 'pooled' },
    publish: normalizeScopeMulti(vcf.publish),
  };
}

function scopeErrors(
  label: string,
  letter: PromoLetter,
  vendorId?: string,
  categoryId?: string,
  opts?: { multi?: boolean; vendorIds?: string[]; categoryIds?: string[] }
): string[] {
  const multi = opts?.multi === true;
  if (letter === 'V') {
    const ids = uniqStrings([...(opts?.vendorIds || []), vendorId]);
    if (!ids.length) {
      return [multi ? `${label}: pick at least one vendor` : `${label}: pick a vendor`];
    }
  }
  if (letter === 'C') {
    const ids = uniqStrings([...(opts?.categoryIds || []), categoryId]);
    if (!ids.length) {
      return [multi ? `${label}: pick at least one category` : `${label}: pick a category`];
    }
  }
  if (
    letter === 'F' &&
    (vendorId || categoryId || opts?.vendorIds?.length || opts?.categoryIds?.length)
  ) {
    return [`${label}: platform must not send a vendor or category`];
  }
  return [];
}

export function validateVcfAudience(vcf: PromoVcfDraft): string[] {
  const errors: string[] = [];
  const vs = vcf.visitSource;
  errors.push(
    ...scopeErrors('Visit source', vs.letter, vs.vendorId, vs.categoryId, {
      multi: true,
      vendorIds: vs.vendorIds,
      categoryIds: vs.categoryIds,
    })
  );
  if (vs.width === 'specific' && !(vs.channels || []).length) {
    errors.push('Specific visit width needs at least one of tele, appointment, Pay Bill, or ecommerce');
  }
  const pub = vcf.publish;
  errors.push(
    ...scopeErrors('Publish', pub.letter, pub.vendorId, pub.categoryId, {
      multi: true,
      vendorIds: pub.vendorIds,
      categoryIds: pub.categoryIds,
    })
  );
  if (!vcf.visitLoop?.kind) errors.push('Pick which visit the offer applies to');
  return errors;
}

/**
 * Seed redeem from Audience (visit first, then publish) when switching to Same vendor / category.
 */
export function inheritRedeemScopeFromAudience(
  vcf: PromoVcfDraft,
  letter: PromoLetter
): Pick<
  NonNullable<PromoVcfDraft['redeem']>,
  | 'vendorId'
  | 'vendorName'
  | 'vendorIds'
  | 'vendorNames'
  | 'categoryId'
  | 'categoryName'
  | 'categoryIds'
  | 'categoryNames'
> {
  if (letter !== 'V' && letter !== 'C') return {};
  const fromVisit = audienceScopeEntries(vcf.visitSource, letter);
  const { ids, names } = fromVisit.ids.length ? fromVisit : audienceScopeEntries(vcf.publish, letter);
  if (!ids.length) return {};
  if (letter === 'V') {
    return { vendorId: ids[0], vendorName: names[0], vendorIds: ids, vendorNames: names };
  }
  return { categoryId: ids[0], categoryName: names[0], categoryIds: ids, categoryNames: names };
}

export function validateVcfBenefits(vcf: PromoVcfDraft, hasDiscount: boolean, hasCashback: boolean): string[] {
  const errors: string[] = [];
  const mode = vcf.benefitMode;
  if (mode === 'discount' && !hasDiscount) errors.push('Set a discount value');
  if (mode === 'cashback' && !hasCashback) errors.push('Set a cashback value');
  if (mode === 'both') {
    if (!hasDiscount || !hasCashback) errors.push('Both requires discount and cashback values');
    if (!(Number(vcf.maxDiscount) > 0)) errors.push('Both requires a max discount greater than 0');
  }
  if (mode === 'cashback' || mode === 'both') {
    if (!(Number(vcf.expiryDays) > 0)) errors.push('Cashback needs expiry days after earn');
    if (!vcf.redeem?.channels?.length) errors.push('Pick at least one spend channel for cashback');
    if (vcf.redeem) {
      const errorsRedeem = scopeErrors('Redeem', vcf.redeem.letter, vcf.redeem.vendorId, vcf.redeem.categoryId, {
        multi: true,
        vendorIds: vcf.redeem.vendorIds,
        categoryIds: vcf.redeem.categoryIds,
      });
      if (errorsRedeem.length) {
        if (vcf.redeem.letter === 'V') {
          errors.push('Redeem: pick at least one vendor (Audience seed or multi-select)');
        } else if (vcf.redeem.letter === 'C') {
          errors.push('Redeem: pick at least one category (Audience seed or multi-select)');
        } else {
          errors.push(...errorsRedeem);
        }
      }
    }
  }
  return errors;
}

const DEFAULT_REDEEM_CHANNELS: NonNullable<PromoVcfDraft['redeem']>['channels'] = [
  'tele',
  'appointment',
  'paybill',
  'ecommerce',
];

/**
 * Seed from Audience only when redeem has no vendor/category ids yet.
 * Multi-select lists are preserved so Audience edits do not wipe them.
 */
export function mapRedeemFromAudience(
  vcf: PromoVcfDraft,
  letter: PromoLetter
): NonNullable<PromoVcfDraft['redeem']> {
  const channels =
    vcf.redeem?.channels?.length ? vcf.redeem.channels : [...DEFAULT_REDEEM_CHANNELS];
  if (letter === 'F') {
    return { letter: 'F', channels };
  }
  if (letter === 'V') {
    const existingIds = resolveRedeemVendorIds(vcf.redeem);
    if (existingIds.length) {
      const names = vcf.redeem?.vendorNames || [];
      return {
        letter: 'V',
        channels,
        vendorIds: existingIds,
        vendorId: existingIds[0],
        vendorNames: names.length ? names : existingIds.map((id) =>
          id === vcf.redeem?.vendorId ? vcf.redeem?.vendorName || id : id
        ),
        vendorName: vcf.redeem?.vendorName || names[0],
      };
    }
    const fromPublish = audienceScopeEntries(vcf.publish, 'V');
    const seed = fromPublish.ids.length ? fromPublish : audienceScopeEntries(vcf.visitSource, 'V');
    return withScopeList({ letter: 'V', channels }, 'V', seed);
  }
  const existingCats = resolveRedeemCategoryIds(vcf.redeem);
  if (existingCats.length) {
    const names = vcf.redeem?.categoryNames || [];
    return {
      letter: 'C',
      channels,
      categoryIds: existingCats,
      categoryId: existingCats[0],
      categoryNames: names.length ? names : existingCats.map((id) =>
        id === vcf.redeem?.categoryId ? vcf.redeem?.categoryName || id : id
      ),
      categoryName: vcf.redeem?.categoryName || names[0],
    };
  }
  const fromPublish = audienceScopeEntries(vcf.publish, 'C');
  const seed = fromPublish.ids.length ? fromPublish : audienceScopeEntries(vcf.visitSource, 'C');
  return withScopeList({ letter: 'C', channels }, 'C', seed);
}

export function syncRedeemAfterAudience(vcf: PromoVcfDraft): PromoVcfDraft {
  const letter = vcf.redeem?.letter;
  if (!letter || letter === 'F') return vcf;
  return { ...vcf, redeem: mapRedeemFromAudience(vcf, letter) };
}

export function applyVcfToDraft(draft: PromoEngineDraft, vcf: PromoVcfDraft): PromoEngineDraft {
  return {
    ...draft,
    vcf,
    ruleType: 'CUSTOMER_JOURNEY',
    updatedAt: new Date().toISOString(),
  };
}

export function vcfOrEmpty(draft?: PromoEngineDraft): PromoVcfDraft {
  return draft?.vcf ? { ...createEmptyVcf(), ...draft.vcf } : createEmptyVcf();
}

/** Normalize redeem lists so singular + arrays stay in sync before save. */
export function normalizeRedeemMulti(
  redeem: NonNullable<PromoVcfDraft['redeem']>
): NonNullable<PromoVcfDraft['redeem']> {
  if (redeem.letter === 'V') {
    const ids = resolveRedeemVendorIds(redeem);
    const names = redeem.vendorNames || [];
    return {
      ...redeem,
      vendorIds: ids.length ? ids : undefined,
      vendorId: ids[0],
      vendorNames: ids.length ? ids.map((id, i) => names[i] || id) : undefined,
      vendorName: names[0] || redeem.vendorName,
      categoryId: undefined,
      categoryIds: undefined,
      categoryName: undefined,
      categoryNames: undefined,
    };
  }
  if (redeem.letter === 'C') {
    const ids = resolveRedeemCategoryIds(redeem);
    const names = redeem.categoryNames || [];
    return {
      ...redeem,
      categoryIds: ids.length ? ids : undefined,
      categoryId: ids[0],
      categoryNames: ids.length ? ids.map((id, i) => names[i] || id) : undefined,
      categoryName: names[0] || redeem.categoryName,
      vendorId: undefined,
      vendorIds: undefined,
      vendorName: undefined,
      vendorNames: undefined,
    };
  }
  return {
    letter: 'F',
    channels: redeem.channels,
  };
}
