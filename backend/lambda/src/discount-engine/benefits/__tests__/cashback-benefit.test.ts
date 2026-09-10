import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountStatus } from '../../enums/discount-status';
import { DiscountTrigger } from '../../enums/discount-trigger';
import type { DiscountCandidate } from '../../candidates/types';
import {
  computeBenefitFromCandidate,
  evaluateCandidateBenefit,
} from '../../candidates/bridges/candidate-to-benefit-context';
import { CashbackBenefitStrategy } from '../strategies/cashback-benefit.strategy';
import {
  buildPbeCashbackIdempotencyKey,
  partitionCashbackBenefitOutcomes,
  sumCashbackAmount,
} from '../cashback';
import { commitPbeCashbackWalletCredit } from '../cashback-wallet-commit';
import { getBenefitCalculator } from '../benefit-calculator';
import {
  computeWpayCommercialQuote,
  WpayCommercialValidationError,
} from '../../../endpoints/customer/warmpawz-pay/shared/wpay-discount';
import { applyWapptCatalogueFeeAmounts } from '../../../endpoints/warmpawz-appointments/shared/wappt-booking-preflight';
import { bookingCalculateRequestToDiscountContext } from '../../adapters/context-mappers';
import { wpayQuoteToDiscountContext } from '../../adapters/commerce-context';
import { appointmentFeeToDiscountContext } from '../../adapters/commerce-context';

jest.mock('../../../database/rds-connection', () => ({
  withTransaction: jest.fn(),
}));

import { withTransaction } from '../../../database/rds-connection';

const mockedWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

function cashbackCandidate(overrides?: Partial<DiscountCandidate>): DiscountCandidate {
  return {
    id: 'promo-cb-1',
    name: 'Pay Bill cashback',
    source: DiscountSource.PLATFORM_PROMOTION,
    owner: DiscountOwner.PLATFORM,
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    status: DiscountStatus.ACTIVE,
    rules: {},
    benefits: {
      type: 'cashback',
      discountType: 'percentage',
      value: 10,
    },
    originalEntity: {},
    ...overrides,
  };
}

function percentageCandidate(): DiscountCandidate {
  return {
    id: 'promo-pct-1',
    name: '10% off',
    source: DiscountSource.VENDOR_PROMOTION,
    owner: DiscountOwner.VENDOR,
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    status: DiscountStatus.ACTIVE,
    rules: {},
    benefits: {
      type: 'flash_sale',
      discountType: 'percentage',
      value: 10,
    },
    originalEntity: {},
  };
}

describe('PBE cashback benefit (Phase 4)', () => {
  it('does not reduce payable and reports a separate cashback amount', () => {
    const strategy = new CashbackBenefitStrategy();
    const result = strategy.calculate({
      originalAmount: 1000,
      currentAmount: 1000,
      eligibleAmount: 1000,
      discountType: 'percentage',
      discountValue: 10,
      promotionType: 'cashback',
    });
    expect(result.discountAmount).toBe(0);
    expect(result.cashbackAmount).toBe(100);
    expect(result.finalAmount).toBe(1000);
    expect(result.appliedBenefit).toBe('cashback');
    expect(result.calculationMetadata?.payableImpact).toBe('none');
  });

  it('coexists with a percentage discount without folding cashback into discount', () => {
    const calculator = getBenefitCalculator();
    const discount = calculator.calculate({
      originalAmount: 1000,
      currentAmount: 1000,
      discountType: 'percentage',
      discountValue: 10,
    });
    const cashback = calculator.calculate({
      originalAmount: 1000,
      currentAmount: 1000,
      discountType: 'percentage',
      discountValue: 5,
      promotionType: 'cashback',
    });
    expect(discount.discountAmount).toBe(100);
    expect(cashback.discountAmount).toBe(0);
    expect(cashback.cashbackAmount).toBe(50);
    expect(discount.finalAmount + (cashback.cashbackAmount ?? 0)).not.toBe(discount.finalAmount);
  });

  it('evaluateCandidateBenefit maps promotion_type cashback on all commerce surfaces', () => {
    const booking = bookingCalculateRequestToDiscountContext({
      vendorId: 'v1',
      amount: 800,
      serviceIds: ['s1'],
    });
    const cart = wpayQuoteToDiscountContext({ quotedAmount: 500, vendorId: 'v1' });
    const appt = appointmentFeeToDiscountContext({ appointmentFee: 199, vendorId: 'v1' });
    expect(booking.commerceModel).toBe('marketplace');
    expect(booking.transactionType).toBe('booking');
    expect(cart.commerceModel).toBe('warmpawz_pay');
    expect(cart.transactionType).toBe('pay_bill');
    expect(appt.commerceModel).toBe('warmpawz_pay');
    expect(appt.transactionType).toBe('appointment');

    for (const amount of [booking.amount, cart.amount, appt.amount]) {
      const result = evaluateCandidateBenefit(cashbackCandidate(), { originalAmount: amount });
      expect(result.discountAmount).toBe(0);
      expect(result.cashbackAmount).toBeGreaterThan(0);
    }
  });

  it('computeBenefitFromCandidate never returns cashback as a payable discount', () => {
    expect(
      computeBenefitFromCandidate(cashbackCandidate(), {
        originalAmount: 1000,
        legacyAmount: 100,
        label: 'cashback',
      })
    ).toBe(0);
  });

  it('partitions cashback so it cannot win exclusive discount stacking', () => {
    const discountOutcome = {
      candidate: percentageCandidate(),
      benefit: { discountAmount: 100, finalAmount: 900, appliedBenefit: 'percentage' },
      discountAmount: 100,
    };
    const cashbackOutcome = {
      candidate: cashbackCandidate(),
      benefit: {
        discountAmount: 0,
        cashbackAmount: 80,
        finalAmount: 1000,
        appliedBenefit: 'cashback' as const,
      },
      discountAmount: 0,
    };
    const { discountBenefits, cashbackBenefits } = partitionCashbackBenefitOutcomes([
      discountOutcome,
      cashbackOutcome,
    ]);
    expect(discountBenefits).toHaveLength(1);
    expect(cashbackBenefits).toHaveLength(1);
    expect(sumCashbackAmount(cashbackBenefits)).toBe(80);
  });

  it('does not change WPay D < C or payNow', () => {
    const quote = computeWpayCommercialQuote({
      quotedAmount: 1000,
      commissionPercent: 20,
      discountPercent: 10,
    });
    const cashback = new CashbackBenefitStrategy().calculate({
      originalAmount: quote.quotedAmount,
      currentAmount: quote.quotedAmount,
      discountType: 'percentage',
      discountValue: 5,
      promotionType: 'cashback',
    });
    expect(quote.payNowAmount).toBe(900);
    expect(quote.discountAmount).toBe(100);
    expect(cashback.discountAmount).toBe(0);
    expect(() =>
      computeWpayCommercialQuote({
        quotedAmount: 1000,
        commissionPercent: 10,
        discountPercent: 20,
      })
    ).toThrow(WpayCommercialValidationError);
  });

  it('does not change Appointment catalogue fee or GST=0 lock', () => {
    expect(applyWapptCatalogueFeeAmounts(199)).toEqual({
      basePrice: 199,
      totalAmount: 199,
      taxAmount: 0,
    });
    const result = evaluateCandidateBenefit(cashbackCandidate(), { originalAmount: 199 });
    expect(result.discountAmount).toBe(0);
    expect(applyWapptCatalogueFeeAmounts(199).totalAmount).toBe(199);
  });

  it('builds a stable idempotency key without timestamps', () => {
    expect(
      buildPbeCashbackIdempotencyKey({
        referenceType: 'pay_bill',
        referenceId: 'pay-1',
        promotionId: 'promo-cb-1',
      })
    ).toBe('pbe_cashback:pay_bill:pay-1:promo-cb-1');
  });

  it('commit is idempotent and does not throw on duplicate', async () => {
    mockedWithTransaction.mockImplementation(async (fn) =>
      fn({
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ column_name: 'description' }, { column_name: 'customer_id' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }),
      } as never)
    );
    const first = await commitPbeCashbackWalletCredit({
      customerId: '11111111-1111-4111-8111-111111111111',
      amount: 50,
      promotionId: 'promo-cb-1',
      referenceType: 'pay_bill',
      referenceId: 'pay-1',
    });
    expect(first.status).toBe('CASHBACK_DUPLICATE_IGNORED');
    expect(first.alreadyCredited).toBe(true);
    expect(first.credited).toBe(false);
  });

  it('commit failure does not look like a payment rollback', async () => {
    mockedWithTransaction.mockRejectedValue(new Error('wallet down'));
    const result = await commitPbeCashbackWalletCredit({
      customerId: '11111111-1111-4111-8111-111111111111',
      amount: 50,
      promotionId: 'promo-cb-1',
      referenceType: 'booking',
      referenceId: 'book-1',
    });
    expect(result.status).toBe('CASHBACK_WALLET_CREDIT_FAILED');
    expect(result.credited).toBe(false);
  });

  it('source guards: evaluate-only — commit is not wired to money paths', () => {
    const root = join(__dirname, '..', '..', '..');
    const quote = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-quote-resolver.ts'),
      'utf8'
    );
    const verify = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/services/customer_warmpawz_pay_verify_post.service.ts'),
      'utf8'
    );
    const booking = readFileSync(
      join(root, 'endpoints/booking/endpoints/bookings-enhanced.booking.ts'),
      'utf8'
    );
    const discount = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-discount.ts'),
      'utf8'
    );
    expect(quote).not.toContain('commitPbeCashbackWalletCredit');
    expect(verify).not.toContain('commitPbeCashbackWalletCredit');
    expect(booking).not.toContain('commitPbeCashbackWalletCredit');
    expect(discount).not.toContain('cashbackAmount');
    expect(quote).toContain('computeWpayCommercialQuote');
  });
});
