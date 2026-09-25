import type { PromoEngineDraft, PromoLetter, PromoVcfDraft } from './types';
import { createEmptyVcf } from './types';

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
  errors.push(
    ...scopeErrors('Visit source', vcf.visitSource.letter, vcf.visitSource.vendorId, vcf.visitSource.categoryId)
  );
  if (vcf.visitSource.width === 'specific' && !(vcf.visitSource.channels || []).length) {
    errors.push('Specific visit width needs at least one of tele, appointment, or Pay Bill');
  }
  errors.push(...scopeErrors('Publish', vcf.publish.letter, vcf.publish.vendorId, vcf.publish.categoryId));
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
  if (letter === 'V') {
    const id =
      vcf.visitSource.letter === 'V' && vcf.visitSource.vendorId
        ? vcf.visitSource.vendorId
        : vcf.publish.letter === 'V' && vcf.publish.vendorId
          ? vcf.publish.vendorId
          : undefined;
    const name =
      vcf.visitSource.letter === 'V' && vcf.visitSource.vendorId
        ? vcf.visitSource.vendorName
        : vcf.publish.letter === 'V'
          ? vcf.publish.vendorName
          : undefined;
    if (!id) return {};
    return {
      vendorId: id,
      vendorName: name,
      vendorIds: [id],
      vendorNames: name ? [name] : [id],
    };
  }
  if (letter === 'C') {
    const id =
      vcf.visitSource.letter === 'C' && vcf.visitSource.categoryId
        ? vcf.visitSource.categoryId
        : vcf.publish.letter === 'C' && vcf.publish.categoryId
          ? vcf.publish.categoryId
          : undefined;
    const name =
      vcf.visitSource.letter === 'C' && vcf.visitSource.categoryId
        ? vcf.visitSource.categoryName
        : vcf.publish.letter === 'C'
          ? vcf.publish.categoryName
          : undefined;
    if (!id) return {};
    return {
      categoryId: id,
      categoryName: name,
      categoryIds: [id],
      categoryNames: name ? [name] : [id],
    };
  }
  return {};
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
    const fromPublish = vcf.publish.letter === 'V';
    const fromVisit = vcf.visitSource.letter === 'V';
    const vendorId = fromPublish
      ? vcf.publish.vendorId
      : fromVisit
        ? vcf.visitSource.vendorId
        : undefined;
    const vendorName = fromPublish
      ? vcf.publish.vendorName
      : fromVisit
        ? vcf.visitSource.vendorName
        : undefined;
    return {
      letter: 'V',
      channels,
      vendorId,
      vendorName,
      vendorIds: vendorId ? [vendorId] : undefined,
      vendorNames: vendorId ? [vendorName || vendorId] : undefined,
    };
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
  const fromPublish = vcf.publish.letter === 'C';
  const fromVisit = vcf.visitSource.letter === 'C';
  const categoryId = fromPublish
    ? vcf.publish.categoryId
    : fromVisit
      ? vcf.visitSource.categoryId
      : undefined;
  const categoryName = fromPublish
    ? vcf.publish.categoryName
    : fromVisit
      ? vcf.visitSource.categoryName
      : undefined;
  return {
    letter: 'C',
    channels,
    categoryId,
    categoryName,
    categoryIds: categoryId ? [categoryId] : undefined,
    categoryNames: categoryId ? [categoryName || categoryId] : undefined,
  };
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
