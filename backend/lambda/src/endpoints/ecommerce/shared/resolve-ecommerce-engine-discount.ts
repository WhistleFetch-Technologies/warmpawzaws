import { loadOwnedEvaluationDiscount } from '../../../discount-engine/promo-engine/services/owned-evaluation';
import { normalizePromoCategory } from '../../../discount-engine/promo-engine/dsl/category-aliases';

export async function resolveEcommerceEngineDiscount(opts: {
  customerId?: string | null;
  evaluationId?: string | null;
  amount: number;
  vendorId?: string | null;
  lines?: Array<{ id?: string; service_category?: string; amount: number }>;
}): Promise<{
  evaluationId: string | null;
  discount: number;
  cashback: number;
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
    };
  }

  const { safeEvaluatePromotions } = await import('../../../discount-engine/promo-engine');
  const ev = await safeEvaluatePromotions({
    user_id: customerId,
    persist: true,
    transaction: {
      type: 'ECOMMERCE',
      service_category: 'ecommerce',
      vendor_id: opts.vendorId || undefined,
      amount: opts.amount,
      lines: (opts.lines || []).map((line) => ({
        id: line.id,
        service_category: normalizePromoCategory(line.service_category) || 'ecommerce',
        amount: line.amount,
      })),
    },
  });
  if (!ev?.evaluation_id) return { evaluationId: null, discount: 0, cashback: 0 };
  return {
    evaluationId: String(ev.evaluation_id),
    discount: Math.max(0, Number(ev.summary.discount) || 0),
    cashback: Math.max(0, Number(ev.summary.cashback) || 0),
  };
}
