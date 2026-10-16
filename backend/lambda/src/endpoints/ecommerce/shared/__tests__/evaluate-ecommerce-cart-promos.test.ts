import { evaluateEcommerceCartPromos } from '../evaluate-ecommerce-cart-promos';
import type { EvaluateRequest, EvaluateResult } from '../../../../discount-engine/promo-engine/types';

function result(partial: {
  discount?: number;
  cashback?: number;
  promotionId?: string;
}): EvaluateResult {
  const discount = partial.discount || 0;
  const cashback = partial.cashback || 0;
  return {
    eligible: discount > 0 || cashback > 0,
    evaluation_id: '',
    winner_promotion_id: partial.promotionId || null,
    benefits:
      discount > 0 || cashback > 0
        ? [
            ...(discount > 0
              ? [
                  {
                    promotion_id: partial.promotionId || 'p',
                    rule_id: 'r',
                    benefit_type: 'DISCOUNT' as const,
                    amount: discount,
                    benefit_index: 0,
                  },
                ]
              : []),
            ...(cashback > 0
              ? [
                  {
                    promotion_id: partial.promotionId || 'p',
                    rule_id: 'r',
                    benefit_type: 'CASHBACK' as const,
                    amount: cashback,
                    benefit_index: 1,
                  },
                ]
              : []),
          ]
        : [],
    summary: { gross_amount: 0, discount, payable: 0, cashback },
    explain: { failures: [], matched_promotions: [], rejected_promotions: [] },
  };
}

describe('evaluateEcommerceCartPromos', () => {
  it('applies each vendor promo to that vendor subtotal and leaves the other full price', async () => {
    const calls: EvaluateRequest[] = [];
    const evaluate = async (req: EvaluateRequest) => {
      calls.push(req);
      const vendor = String(req.transaction.vendorId || '');
      const letters = req.transaction.publish_letters || [];
      if (letters.includes('V') && vendor === 'vendor-a') return result({ discount: 70, promotionId: 'promo-a' });
      if (letters.includes('V') && vendor === 'vendor-b') return result({ discount: 0 });
      return result({ discount: 0 });
    };

    const out = await evaluateEcommerceCartPromos({
      userId: 'cust',
      persist: false,
      evaluate,
      lines: [
        { id: 'kurta', vendorId: 'vendor-a', amount: 444 },
        { id: 'food', vendorId: 'vendor-b', amount: 500 },
      ],
    });

    expect(out.summary.discount).toBe(70);
    expect(out.lineDiscounts).toEqual([
      { id: 'kurta', discount: 70 },
      { id: 'food', discount: 0 },
    ]);
    expect(calls.map((c) => c.transaction.publish_letters)).toEqual([['V'], ['V'], ['F']]);
    expect(calls[0].transaction.amount).toBe(444);
    expect(calls[1].transaction.amount).toBe(500);
    expect(calls[2].transaction.amount).toBe(500);
    expect(calls[2].transaction.vendorId).toBeUndefined();
  });

  it('sums two vendor promos and does not run the platform promo', async () => {
    const calls: EvaluateRequest[] = [];
    const evaluate = async (req: EvaluateRequest) => {
      calls.push(req);
      const vendor = String(req.transaction.vendorId || '');
      if (vendor === 'vendor-a') return result({ discount: 60, cashback: 20, promotionId: 'a' });
      if (vendor === 'vendor-b') return result({ discount: 40, cashback: 10, promotionId: 'b' });
      return result({ discount: 999, promotionId: 'platform' });
    };

    const out = await evaluateEcommerceCartPromos({
      userId: 'cust',
      persist: false,
      evaluate,
      lines: [
        { id: 'a1', vendorId: 'vendor-a', amount: 200 },
        { id: 'a2', vendorId: 'vendor-a', amount: 100 },
        { id: 'b1', vendorId: 'vendor-b', amount: 800 },
      ],
    });

    expect(out.summary.discount).toBe(100);
    expect(out.summary.cashback).toBe(30);
    expect(out.lineDiscounts).toEqual([
      { id: 'a1', discount: 40 },
      { id: 'a2', discount: 20 },
      { id: 'b1', discount: 40 },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].transaction.amount).toBe(300);
    expect(calls[1].transaction.amount).toBe(800);
  });

  it('applies one platform promo to the combined uncovered amount', async () => {
    const calls: EvaluateRequest[] = [];
    const evaluate = async (req: EvaluateRequest) => {
      calls.push(req);
      if ((req.transaction.publish_letters || []).includes('F')) {
        return result({ discount: 50, promotionId: 'festive' });
      }
      return result({ discount: 0 });
    };

    const out = await evaluateEcommerceCartPromos({
      userId: 'cust',
      persist: false,
      evaluate,
      lines: [
        { id: 'a', vendorId: 'vendor-a', amount: 100 },
        { id: 'b', vendorId: 'vendor-b', amount: 250 },
      ],
    });

    expect(out.summary.discount).toBe(50);
    expect(out.lineDiscounts).toEqual([
      { id: 'a', discount: expect.any(Number) },
      { id: 'b', discount: expect.any(Number) },
    ]);
    expect(out.lineDiscounts.reduce((sum, row) => sum + row.discount, 0)).toBe(50);
    expect(calls[calls.length - 1].transaction.amount).toBe(350);
    expect(calls[calls.length - 1].transaction.publish_letters).toEqual(['F']);
  });
});
