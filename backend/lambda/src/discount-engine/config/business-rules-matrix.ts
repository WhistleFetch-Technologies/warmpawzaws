/**
 * Offer combination matrix — configurable pairs derived from offer types.
 */
import type { OfferCombinationRule, OfferTypeDefinition } from './business-rules-types';
import { DEFAULT_OFFER_TYPES } from './business-rules-types';

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

export function buildDefaultCombinationMatrix(
  offerTypes: OfferTypeDefinition[] = DEFAULT_OFFER_TYPES
): OfferCombinationRule[] {
  const keys = offerTypes.map((o) => o.key);
  const rules: OfferCombinationRule[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const left = keys[i];
      const right = keys[j];
      rules.push({
        id: pairKey(left, right),
        left,
        right,
        allowed: false,
      });
    }
  }

  return rules;
}

export function mergeCombinationMatrix(
  defaults: OfferCombinationRule[],
  existing: OfferCombinationRule[] | undefined
): OfferCombinationRule[] {
  if (!existing?.length) return defaults;
  const byId = new Map(existing.map((r) => [r.id, r]));
  return defaults.map((d) => byId.get(d.id) ?? d);
}

function isPromotionType(key: string): boolean {
  return key === 'VENDOR_PROMOTION' || key === 'PLATFORM_PROMOTION';
}

function isCouponType(key: string): boolean {
  return key === 'VENDOR_COUPON' || key === 'PLATFORM_COUPON';
}

/** Preset matrix for PROMOTION_PLUS_COUPON: promo+coupon allowed, promo+promo and coupon+coupon blocked. */
export function buildPromotionPlusCouponMatrix(
  offerTypes: OfferTypeDefinition[] = DEFAULT_OFFER_TYPES
): OfferCombinationRule[] {
  return buildDefaultCombinationMatrix(offerTypes).map((rule) => {
    const promoCoupon =
      (isPromotionType(rule.left) && isCouponType(rule.right)) ||
      (isCouponType(rule.left) && isPromotionType(rule.right));
    return { ...rule, allowed: promoCoupon };
  });
}
