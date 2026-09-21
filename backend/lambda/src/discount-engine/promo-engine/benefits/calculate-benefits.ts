import { applyCombinedCap } from '../vcf/combined-cap';
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
  combinedMax?: number | null;
  benefitMode?: 'discount' | 'cashback' | 'both';
}): AppliedBenefit[] {
  const amount = Math.max(0, Number(opts.orderAmount) || 0);
  const out: AppliedBenefit[] = [];
  const mode = opts.benefitMode;

  opts.benefits.forEach((b, benefit_index) => {
    if (!b?.type) return;
    if (mode === 'cashback' && b.type === 'DISCOUNT') return;
    if (mode === 'discount' && b.type === 'CASHBACK') return;
    const v = Number(b.value) || 0;
    if (b.type === 'DISCOUNT') {
      let discount = valueType(b) === 'PERCENT' ? (amount * v) / 100 : v;
      const cap = maxCap(b);
      if (cap != null) discount = Math.min(discount, cap);
      if (mode === 'discount' && opts.combinedMax != null && Number.isFinite(opts.combinedMax)) {
        discount = Math.min(discount, Number(opts.combinedMax));
      }
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

  if (mode === 'both' && opts.combinedMax != null) {
    const discount = out.filter((b) => b.benefit_type === 'DISCOUNT').reduce((s, b) => s + b.amount, 0);
    const cashback = out.filter((b) => b.benefit_type === 'CASHBACK').reduce((s, b) => s + b.amount, 0);
    const capped = applyCombinedCap({
      discount,
      cashback,
      maxDiscount: opts.combinedMax,
      billAmount: amount,
    });
    return scaleBenefitsToCap(out, capped.discount, capped.cashback);
  }

  return out;
}

function scaleBenefitsToCap(
  benefits: AppliedBenefit[],
  discount: number,
  cashback: number
): AppliedBenefit[] {
  const currentD = benefits.filter((b) => b.benefit_type === 'DISCOUNT').reduce((s, b) => s + b.amount, 0);
  const currentC = benefits.filter((b) => b.benefit_type === 'CASHBACK').reduce((s, b) => s + b.amount, 0);
  return benefits
    .map((b) => {
      if (b.benefit_type === 'DISCOUNT') {
        const amount =
          currentD > 0 ? Math.round((b.amount * (discount / currentD)) * 100) / 100 : 0;
        return { ...b, amount };
      }
      const amount =
        currentC > 0 ? Math.round((b.amount * (cashback / currentC)) * 100) / 100 : 0;
      return { ...b, amount };
    })
    .filter((b) => b.amount > 0);
}
