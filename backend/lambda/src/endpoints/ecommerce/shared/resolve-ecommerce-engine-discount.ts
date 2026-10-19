import { loadOwnedEvaluationDiscount } from '../../../discount-engine/promo-engine/services/owned-evaluation';
import type { BenefitCapNotice } from '../../../discount-engine/promo-engine/benefit-cap/gate';
import { evaluateEcommerceCartPromos } from './evaluate-ecommerce-cart-promos';

export async function resolveEcommerceEngineDiscount(opts: {
  customerId?: string | null;
  evaluationId?: string | null;
  amount: number;
  vendorId?: string | null;
  lines?: Array<{ id?: string; service_category?: string; amount: number; vendorId?: string | null }>;
}): Promise<{
  evaluationId: string | null;
  discount: number;
  cashback: number;
  benefitCap?: BenefitCapNotice | null;
}> {
  const customerId = String(opts.customerId || '').trim();
  if (!customerId || !(opts.amount > 0)) {
    return { evaluationId: null, discount: 0, cashback: 0 };
  }

  const stored = await loadOwnedEvaluationDiscount(String(opts.evaluationId || ''), customerId);
  if (stored) {
    return {
      evaluationId: stored.evaluationId,
      discount: stored.discount,
      cashback: stored.cashback,
      benefitCap: stored.benefitCap,
    };
  }

  const lines =
    opts.lines && opts.lines.length > 0
      ? opts.lines.map((line) => ({
          id: line.id,
          vendorId: line.vendorId || opts.vendorId || null,
          amount: line.amount,
        }))
      : [{ vendorId: opts.vendorId || null, amount: opts.amount }];
  const ev = await evaluateEcommerceCartPromos({
    userId: customerId,
    persist: true,
    lines,
  });
  if (!ev?.evaluation_id) return { evaluationId: null, discount: 0, cashback: 0 };
  return {
    evaluationId: String(ev.evaluation_id),
    discount: Math.max(0, Number(ev.summary.discount) || 0),
    cashback: Math.max(0, Number(ev.summary.cashback) || 0),
    benefitCap: ev.benefit_cap ?? null,
  };
}
