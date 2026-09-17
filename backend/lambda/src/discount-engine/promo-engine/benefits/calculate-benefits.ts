import type { AppliedBenefit, PromoEngineBenefit, ServiceCategory } from '../types';

function valueType(b: PromoEngineBenefit): 'PERCENT' | 'FIXED' {
  const raw = (b.value_type || b.mode || 'FIXED').toString().toUpperCase();
  if (raw === 'PERCENTAGE' || raw === 'PERCENT') return 'PERCENT';
  return 'FIXED';
}

function maxCap(b: PromoEngineBenefit): number | null {
  const m = b.max_amount ?? b.maxAmount;
  return typeof m === 'number' && Number.isFinite(m) ? m : null;
}

function expiryDays(b: PromoEngineBenefit): number | undefined {
  const d = b.expiry_days ?? b.expiryDays;
  return typeof d === 'number' ? d : undefined;
}

function redeemScope(b: PromoEngineBenefit): ServiceCategory[] | undefined {
  if (Array.isArray(b.redeemScope)) return b.redeemScope;
  if (b.redeem_scope?.services) return b.redeem_scope.services;
  return undefined;
}

export function calculateBenefits(opts: {
  promotionId: string;
  ruleId: string;
  benefits: PromoEngineBenefit[];
  orderAmount: number;
}): AppliedBenefit[] {
  const amount = Math.max(0, Number(opts.orderAmount) || 0);
  const out: AppliedBenefit[] = [];

  opts.benefits.forEach((b, benefit_index) => {
    if (!b?.type) return;
    const v = Number(b.value) || 0;
    if (b.type === 'DISCOUNT') {
      let discount = valueType(b) === 'PERCENT' ? (amount * v) / 100 : v;
      const cap = maxCap(b);
      if (cap != null) discount = Math.min(discount, cap);
      discount = Math.min(Math.max(0, discount), amount);
      if (discount > 0) {
        out.push({
          promotion_id: opts.promotionId,
          rule_id: opts.ruleId,
          benefit_type: 'DISCOUNT',
          amount: Math.round(discount * 100) / 100,
          benefit_index,
        });
      }
      return;
    }
    if (b.type === 'CASHBACK') {
      let cb = valueType(b) === 'PERCENT' ? (amount * v) / 100 : v;
      const cap = maxCap(b);
      if (cap != null) cb = Math.min(cb, cap);
      cb = Math.max(0, cb);
      if (cb > 0) {
        out.push({
          promotion_id: opts.promotionId,
          rule_id: opts.ruleId,
          benefit_type: 'CASHBACK',
          amount: Math.round(cb * 100) / 100,
          expiry_days: expiryDays(b),
          redeem_scope: redeemScope(b),
          benefit_index,
        });
      }
    }
  });

  return out;
}
