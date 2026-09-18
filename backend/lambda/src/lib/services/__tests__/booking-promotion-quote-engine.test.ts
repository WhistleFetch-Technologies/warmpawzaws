import { buildUnifiedQuoteFromEngine } from '../booking-promotion-service';
import type { EvaluateResult } from '../../../discount-engine/promo-engine/types';

function result(partial: Partial<EvaluateResult> & { summary: EvaluateResult['summary'] }): EvaluateResult {
  return {
    eligible: true,
    evaluation_id: 'eval-1',
    benefits: [],
    explain: { failures: [], matched_promotions: ['promo-1'], rejected_promotions: [] },
    ...partial,
  };
}

describe('buildUnifiedQuoteFromEngine', () => {
  it('applies Promotion Engine discount to payable and ignores coupons', () => {
    const quote = buildUnifiedQuoteFromEngine({
      amount: 699,
      couponCode: 'OLD10',
      result: result({
        summary: { gross_amount: 699, discount: 5, payable: 694, cashback: 150 },
        benefits: [
          {
            promotion_id: 'promo-1',
            rule_id: 'r1',
            benefit_type: 'CASHBACK',
            amount: 150,
            expiry_days: 30,
            redeem_scope: ['VET'],
            benefit_index: 1,
          },
        ],
      }),
    });

    expect(quote.savings.totalSavings).toBe(5);
    expect(quote.savings.finalAmount).toBe(694);
    expect(quote.savings.couponDiscountAmount).toBe(0);
    expect(quote.appliedOffers).toHaveLength(1);
    expect(quote.appliedOffers[0].offerType).toBe('PROMO_ENGINE');
    expect(quote.promoEngine?.pendingCashback).toBe(150);
    expect(quote.rejectedOffers[0].reasonCode).toBe('COUPONS_RETIRED');
  });

  it('returns zero savings when engine is not eligible', () => {
    const quote = buildUnifiedQuoteFromEngine({
      amount: 699,
      result: result({
        eligible: false,
        summary: { gross_amount: 699, discount: 0, payable: 699, cashback: 0 },
        explain: { failures: [], matched_promotions: [], rejected_promotions: [] },
      }),
    });
    expect(quote.appliedOffers).toHaveLength(0);
    expect(quote.savings.finalAmount).toBe(699);
    expect(quote.promoEngine?.eligible).toBe(false);
  });
});
