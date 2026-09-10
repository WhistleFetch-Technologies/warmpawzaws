import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountDomain } from '../../enums/discount-domain';
import type { ResolverResult } from '../../resolver/types';
import { wpayQuoteToDiscountContext } from '../commerce-context';
import {
  compareWpayPayBillShadow,
  evaluateWpayPayBillShadow,
  scheduleWpayPayBillShadow,
} from '../wpay-pay-bill-shadow';
import {
  assertDiscountBelowCommission,
  computeWpayCommercialQuote,
  computeWpayDiscountQuote,
  WpayCommercialValidationError,
} from '../../../endpoints/customer/warmpawz-pay/shared/wpay-discount';

const resolveMock = jest.fn();

jest.mock('../../resolver/unified-discount-resolver', () => ({
  getUnifiedDiscountResolver: () => ({
    resolve: (...args: unknown[]) => resolveMock(...args),
  }),
}));

function stubResolver(totalSavings: number, appliedIds: string[] = []): ResolverResult {
  return {
    originalAmount: 1000,
    totalSavings,
    finalAmount: Math.max(0, 1000 - totalSavings),
    applied: appliedIds.map((id, order) => ({
      id,
      name: id,
      owner: 'platform' as never,
      trigger: 'auto' as never,
      discountAmount: totalSavings,
      order: order + 1,
    })),
    benefits: [],
    messages: [],
    warnings: [],
    metadata: {},
    eligibleCandidates: [],
    rejectedCandidates: [],
    appliedCandidates: [],
    benefitResults: [],
    ruleResults: [],
    executionTimeMs: 1,
    resolverVersion: 'test',
  };
}

describe('WPay Pay Bill shadow (Phase 2)', () => {
  const originalMode = process.env.PBE_COMMERCE_CONTEXT_MODE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.PBE_COMMERCE_CONTEXT_MODE;
    else process.env.PBE_COMMERCE_CONTEXT_MODE = originalMode;
    resolveMock.mockReset();
  });

  it('maps quote Q to warmpawz_pay + pay_bill', () => {
    const context = wpayQuoteToDiscountContext({
      quotedAmount: 1500,
      vendorId: 'vendor-1',
      customerId: 'cust-1',
    });
    expect(context.commerceModel).toBe('warmpawz_pay');
    expect(context.transactionType).toBe('pay_bill');
    expect(context.amount).toBe(1500);
    expect(context.domain).toBe(DiscountDomain.SERVICE);
    expect(context.vendorId).toBe('vendor-1');
  });

  it('MATCH when both sides have no discount', () => {
    const comparison = compareWpayPayBillShadow({
      quotedAmount: 1000,
      wpayDiscountAmount: 0,
      wpayDiscountPercent: 0,
      shadowDiscountAmount: 0,
      shadowPromotionIds: [],
    });
    expect(comparison.category).toBe('MATCH');
    expect(comparison.wpayDiscountKind).toBe('commercial_pricing');
    expect(comparison.shadowDiscountKind).toBe('promotion_engine');
  });

  it('MATCH when commercial D equals V2 savings', () => {
    const comparison = compareWpayPayBillShadow({
      quotedAmount: 1000,
      wpayDiscountAmount: 100,
      wpayDiscountPercent: 10,
      shadowDiscountAmount: 100,
      shadowPromotionIds: ['promo-1'],
    });
    expect(comparison.category).toBe('MATCH');
    expect(comparison.amountDelta).toBe(0);
  });

  it('DIFF_AMOUNT when commercial D and V2 savings differ', () => {
    const comparison = compareWpayPayBillShadow({
      quotedAmount: 1000,
      wpayDiscountAmount: 100,
      wpayDiscountPercent: 10,
      shadowDiscountAmount: 50,
      shadowPromotionIds: ['promo-1'],
    });
    expect(comparison.category).toBe('DIFF_AMOUNT');
    expect(comparison.amountDelta).toBe(-50);
  });

  it('NO_PROMOTION when V2 has no benefit but WPay has commercial pricing', () => {
    const comparison = compareWpayPayBillShadow({
      quotedAmount: 1000,
      wpayDiscountAmount: 100,
      wpayDiscountPercent: 10,
      shadowDiscountAmount: 0,
      shadowPromotionIds: [],
    });
    expect(comparison.category).toBe('NO_PROMOTION');
  });

  it('DIFF_ROUNDING for sub-5-paise gaps', () => {
    const comparison = compareWpayPayBillShadow({
      quotedAmount: 999,
      wpayDiscountAmount: 99.9,
      wpayDiscountPercent: 10,
      shadowDiscountAmount: 99.93,
      shadowPromotionIds: ['promo-1'],
    });
    expect(comparison.category).toBe('DIFF_ROUNDING');
  });

  it('ENGINE_ERROR is fail-open — WPay quote still succeeds', async () => {
    const comparison = await evaluateWpayPayBillShadow(
      {
        quotedAmount: 1000,
        vendorId: 'vendor-1',
        wpayDiscountAmount: 100,
        wpayDiscountPercent: 10,
      },
      async () => {
        throw new Error('resolver exploded');
      }
    );
    expect(comparison.category).toBe('ENGINE_ERROR');
    expect(comparison.engineError).toMatch(/resolver exploded/);

    const quote = computeWpayDiscountQuote(1000, 10);
    expect(quote.payableAmount).toBe(900);
    expect(quote.discountAmount).toBe(100);
  });

  it('evaluate uses injected resolver savings for MATCH', async () => {
    const comparison = await evaluateWpayPayBillShadow(
      {
        quotedAmount: 1000,
        vendorId: 'vendor-1',
        wpayDiscountAmount: 80,
        wpayDiscountPercent: 8,
      },
      async (context) => {
        expect(context.commerceModel).toBe('warmpawz_pay');
        expect(context.transactionType).toBe('pay_bill');
        expect(context.amount).toBe(1000);
        return stubResolver(80, ['promo-eq']);
      }
    );
    expect(comparison.category).toBe('MATCH');
    expect(comparison.shadowPromotionIds).toEqual(['promo-eq']);
  });

  it('OFF schedule does not call Discount Engine V2', async () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'OFF';
    scheduleWpayPayBillShadow({
      quotedAmount: 1000,
      wpayDiscountAmount: 100,
      wpayDiscountPercent: 10,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('SHADOW schedule evaluates the same resolver singleton path', async () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'SHADOW';
    resolveMock.mockResolvedValue(stubResolver(0));
    scheduleWpayPayBillShadow({
      quotedAmount: 1000,
      vendorId: 'vendor-1',
      wpayDiscountAmount: 100,
      wpayDiscountPercent: 10,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commerceModel: 'warmpawz_pay',
        transactionType: 'pay_bill',
        amount: 1000,
      })
    );
  });

  it('keeps computeWpayCommercialQuote as D < C owner', () => {
    expect(() => assertDiscountBelowCommission(10, 20)).toThrow(WpayCommercialValidationError);
    expect(() =>
      computeWpayCommercialQuote({
        quotedAmount: 1000,
        commissionPercent: 10,
        discountPercent: 20,
      })
    ).toThrow(WpayCommercialValidationError);

    const ok = computeWpayCommercialQuote({
      quotedAmount: 1000,
      commissionPercent: 20,
      discountPercent: 10,
    });
    expect(ok.discountAmount).toBe(100);
    expect(ok.payNowAmount).toBe(900);
    expect(ok.vendorPayableAmount).toBe(800);
  });

  it('WPay rounding stays Math.round to 2 decimals', () => {
    const quote = computeWpayDiscountQuote(999, 10);
    expect(quote.discountAmount).toBe(99.9);
    expect(quote.payableAmount).toBe(899.1);
  });

  it('source guards: quote still owns commercial math; appointment unwired; no usage commit', () => {
    const root = join(__dirname, '..', '..', '..');
    const quoteResolver = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-quote-resolver.ts'),
      'utf8'
    );
    const discount = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-discount.ts'),
      'utf8'
    );
    const verify = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/services/customer_warmpawz_pay_verify_post.service.ts'),
      'utf8'
    );
    const bookingCreate = readFileSync(
      join(root, 'endpoints/booking/endpoints/bookings-enhanced.booking.ts'),
      'utf8'
    );
    const shadow = readFileSync(join(__dirname, '..', 'wpay-pay-bill-shadow.ts'), 'utf8');

    expect(quoteResolver).toContain('computeWpayCommercialQuote');
    expect(quoteResolver).toContain('scheduleWpayPayBillShadow');
    expect(quoteResolver).not.toContain('commitResolverUsageEntries');
    expect(discount).toContain('assertDiscountBelowCommission');
    expect(discount).not.toContain('getUnifiedDiscountResolver');
    expect(verify).not.toContain('scheduleWpayPayBillShadow');
    expect(verify).not.toContain('evaluateWpayPayBillShadow');
    expect(bookingCreate).toContain('wapptAppointmentFee == null');
    expect(bookingCreate).not.toContain('appointmentRequestToDiscountContext');
    expect(shadow).not.toContain('commitResolverUsageEntries');
    expect(shadow).not.toContain('class WPayPromotionEngine');
    expect(shadow).not.toContain('class AppointmentPromotionEngine');
  });
});
