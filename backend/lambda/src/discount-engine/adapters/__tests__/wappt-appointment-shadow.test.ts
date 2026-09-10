import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountDomain } from '../../enums/discount-domain';
import type { ResolverResult } from '../../resolver/types';
import { appointmentFeeToDiscountContext } from '../commerce-context';
import {
  compareWapptAppointmentShadow,
  evaluateWapptAppointmentShadow,
  scheduleWapptAppointmentShadow,
} from '../wappt-appointment-shadow';
import { applyWapptCatalogueFeeAmounts } from '../../../endpoints/warmpawz-appointments/shared/wappt-booking-preflight';
import { assertCommerceModelId } from '../commerce-context';

const resolveMock = jest.fn();

jest.mock('../../resolver/unified-discount-resolver', () => ({
  getUnifiedDiscountResolver: () => ({
    resolve: (...args: unknown[]) => resolveMock(...args),
  }),
}));

function stubResolver(totalSavings: number, appliedIds: string[] = []): ResolverResult {
  return {
    originalAmount: 199,
    totalSavings,
    finalAmount: Math.max(0, 199 - totalSavings),
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

describe('Appointment shadow (Phase 3)', () => {
  const originalMode = process.env.PBE_COMMERCE_CONTEXT_MODE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.PBE_COMMERCE_CONTEXT_MODE;
    else process.env.PBE_COMMERCE_CONTEXT_MODE = originalMode;
    resolveMock.mockReset();
  });

  it('maps catalogue fee to warmpawz_pay + appointment without inventing a SKU', () => {
    const context = appointmentFeeToDiscountContext({
      appointmentFee: 199,
      vendorId: 'vendor-1',
      customerId: 'cust-1',
    });
    expect(context.commerceModel).toBe('warmpawz_pay');
    expect(context.transactionType).toBe('appointment');
    expect(context.amount).toBe(199);
    expect(context.domain).toBe(DiscountDomain.SERVICE);
    expect(context.booking?.serviceIds).toBeUndefined();
    expect(context.items).toBeUndefined();
  });

  it('rejects appointment as a commerce model', () => {
    expect(() => assertCommerceModelId('appointment')).toThrow(/Invalid commerce model/);
  });

  it('NO_PROMOTION when V2 finds nothing (current path also has no discount)', () => {
    const comparison = compareWapptAppointmentShadow({
      appointmentFee: 199,
      shadowDiscountAmount: 0,
      shadowPromotionIds: [],
    });
    expect(comparison.category).toBe('NO_PROMOTION');
    expect(comparison.currentDiscountAmount).toBe(0);
    expect(comparison.commerceModel).toBe('warmpawz_pay');
    expect(comparison.transactionType).toBe('appointment');
  });

  it('DIFF_AMOUNT when V2 would apply a promotion the current skip does not', () => {
    const comparison = compareWapptAppointmentShadow({
      appointmentFee: 199,
      shadowDiscountAmount: 20,
      shadowPromotionIds: ['promo-1'],
    });
    expect(comparison.category).toBe('DIFF_AMOUNT');
    expect(comparison.amountDelta).toBe(20);
  });

  it('ENGINE_ERROR is fail-open — catalogue fee still locks payable', async () => {
    const comparison = await evaluateWapptAppointmentShadow(
      { appointmentFee: 199, vendorId: 'vendor-1' },
      async () => {
        throw new Error('resolver exploded');
      }
    );
    expect(comparison.category).toBe('ENGINE_ERROR');
    expect(applyWapptCatalogueFeeAmounts(199)).toEqual({
      basePrice: 199,
      totalAmount: 199,
      taxAmount: 0,
    });
  });

  it('evaluate can run Appointment context through the injected resolver', async () => {
    const comparison = await evaluateWapptAppointmentShadow(
      { appointmentFee: 199, vendorId: 'vendor-1', customerId: 'cust-1' },
      async (context) => {
        expect(context.commerceModel).toBe('warmpawz_pay');
        expect(context.transactionType).toBe('appointment');
        expect(context.amount).toBe(199);
        return stubResolver(0);
      }
    );
    expect(comparison.category).toBe('NO_PROMOTION');
  });

  it('OFF schedule does not call Discount Engine V2', async () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'OFF';
    scheduleWapptAppointmentShadow({ appointmentFee: 199 });
    await new Promise((resolve) => setImmediate(resolve));
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('SHADOW schedule uses the same resolver path', async () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'SHADOW';
    resolveMock.mockResolvedValue(stubResolver(0));
    scheduleWapptAppointmentShadow({ appointmentFee: 199, vendorId: 'vendor-1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commerceModel: 'warmpawz_pay',
        transactionType: 'appointment',
        amount: 199,
      })
    );
  });

  it('source guards: skip stays, fee lock stays, no usage commit, no third model', () => {
    const root = join(__dirname, '..', '..', '..');
    const bookingCreate = readFileSync(
      join(root, 'endpoints/booking/endpoints/bookings-enhanced.booking.ts'),
      'utf8'
    );
    const preflight = readFileSync(
      join(root, 'endpoints/warmpawz-appointments/shared/wappt-booking-preflight.ts'),
      'utf8'
    );
    const shadow = readFileSync(join(__dirname, '..', 'wappt-appointment-shadow.ts'), 'utf8');
    const quoteResolver = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-quote-resolver.ts'),
      'utf8'
    );
    const commerceModel = readFileSync(
      join(root, 'commerce-switch/contracts/commerce-model.ts'),
      'utf8'
    );

    expect(bookingCreate).toContain('wapptAppointmentFee == null');
    expect(bookingCreate).toContain('scheduleWapptAppointmentShadow');
    expect(bookingCreate).not.toContain('commitResolverUsageEntries');
    expect(preflight).toContain('taxAmount: 0');
    expect(shadow).not.toContain('commitResolverUsageEntries');
    expect(shadow).not.toContain('class AppointmentPromotionEngine');
    expect(quoteResolver).not.toContain('scheduleWapptAppointmentShadow');
    expect(commerceModel).toContain("'marketplace' | 'warmpawz_pay'");
    expect(commerceModel).not.toContain("'appointment'");
  });
});
