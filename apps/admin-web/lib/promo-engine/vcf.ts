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

/**
 * Redeem "Same vendor / Same category" copies Audience (visit source first, then publish).
 */
export function inheritRedeemScopeFromAudience(
  vcf: PromoVcfDraft,
  letter: PromoLetter
): Pick<
  NonNullable<PromoVcfDraft['redeem']>,
  'vendorId' | 'vendorName' | 'categoryId' | 'categoryName'
> {
  if (letter === 'V') {
    if (vcf.visitSource.letter === 'V' && vcf.visitSource.vendorId) {
      return {
        vendorId: vcf.visitSource.vendorId,
        vendorName: vcf.visitSource.vendorName,
      };
    }
    if (vcf.publish.letter === 'V' && vcf.publish.vendorId) {
      return {
        vendorId: vcf.publish.vendorId,
        vendorName: vcf.publish.vendorName,
      };
    }
    return {};
  }
  if (letter === 'C') {
    if (vcf.visitSource.letter === 'C' && vcf.visitSource.categoryId) {
      return {
        categoryId: vcf.visitSource.categoryId,
        categoryName: vcf.visitSource.categoryName,
      };
    }
    if (vcf.publish.letter === 'C' && vcf.publish.categoryId) {
      return {
        categoryId: vcf.publish.categoryId,
        categoryName: vcf.publish.categoryName,
      };
    }
    return {};
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
      const errorsRedeem = scopeErrors(
        'Redeem',
        vcf.redeem.letter,
        vcf.redeem.vendorId,
        vcf.redeem.categoryId
      );
      if (errorsRedeem.length) {
        if (vcf.redeem.letter === 'V') {
          errors.push(
            'Redeem: pick a vendor on Audience (visit source or publish), then choose Same vendor'
          );
        } else if (vcf.redeem.letter === 'C') {
          errors.push(
            'Redeem: pick a category on Audience (visit source or publish), then choose Same category'
          );
        } else {
          errors.push(...errorsRedeem);
        }
      }
    }
  }
  return errors;
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
