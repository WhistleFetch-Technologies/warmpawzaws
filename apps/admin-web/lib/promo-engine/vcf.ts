import type { PromoEngineDraft, PromoLetter, PromoVcfDraft } from './types';
import { createEmptyVcf } from './types';

function scopeErrors(label: string, letter: PromoLetter, vendorId?: string, categoryId?: string): string[] {
  if (letter === 'V' && !vendorId) return [`${label}: pick a vendor`];
  if (letter === 'C' && !categoryId) return [`${label}: pick a category`];
  if (letter === 'F' && (vendorId || categoryId)) return [`${label}: platform must not send a vendor or category`];
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
      errors.push(...scopeErrors('Redeem', vcf.redeem.letter, vcf.redeem.vendorId, vcf.redeem.categoryId));
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
 * Redeem V/C copies the vendor or category already chosen on publish (preferred)
 * or visit source. Admin has no second search on the cashback step.
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
    const fromPublish = vcf.publish.letter === 'V';
    const fromVisit = vcf.visitSource.letter === 'V';
    return {
      letter: 'V',
      channels,
      vendorId: fromPublish
        ? vcf.publish.vendorId
        : fromVisit
          ? vcf.visitSource.vendorId
          : vcf.redeem?.vendorId,
      vendorName: fromPublish
        ? vcf.publish.vendorName
        : fromVisit
          ? vcf.visitSource.vendorName
          : vcf.redeem?.vendorName,
    };
  }
  const fromPublish = vcf.publish.letter === 'C';
  const fromVisit = vcf.visitSource.letter === 'C';
  return {
    letter: 'C',
    channels,
    categoryId: fromPublish
      ? vcf.publish.categoryId
      : fromVisit
        ? vcf.visitSource.categoryId
        : vcf.redeem?.categoryId,
    categoryName: fromPublish
      ? vcf.publish.categoryName
      : fromVisit
        ? vcf.visitSource.categoryName
        : vcf.redeem?.categoryName,
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
