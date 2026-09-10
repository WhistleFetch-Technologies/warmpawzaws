import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountTrigger } from '../../enums/discount-trigger';
import { getUnifiedDiscountResolver } from '../../resolver/unified-discount-resolver';
import {
  applyDiscountCommerceContext,
  appointmentRequestToDiscountContext,
  assertCommerceModelId,
  payBillRequestToDiscountContext,
  resolveDiscountCommerceModelFromSwitch,
} from '../commerce-context';
import {
  bookingCalculateRequestToDiscountContext,
  vendorCartPromotionsToDiscountContext,
} from '../context-mappers';
import { getCommerceResolver } from '../../../commerce-switch/di/commerce-switch-container';
import {
  assertDiscountBelowCommission,
  computeWpayCommercialQuote,
  computeWpayDiscountQuote,
  WpayCommercialValidationError,
} from '../../../endpoints/customer/warmpawz-pay/shared/wpay-discount';

jest.mock('../../../commerce-switch/di/commerce-switch-container', () => ({
  getCommerceResolver: jest.fn(),
}));

const mockedGetResolver = getCommerceResolver as jest.MockedFunction<typeof getCommerceResolver>;

function mockActiveModel(activeModelId: 'marketplace' | 'warmpawz_pay') {
  mockedGetResolver.mockReturnValue({
    resolveActiveModel: jest.fn().mockResolvedValue({
      activeModelId,
      configurationVersion: 1,
      resolvedAt: new Date().toISOString(),
      source: 'database',
    }),
  } as any);
}

describe('discount commerce context (Phase 1 foundation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stamps marketplace booking from calculate-booking mapper', () => {
    const context = bookingCalculateRequestToDiscountContext({
      vendorId: 'v1',
      amount: 1200,
      serviceIds: ['svc-1'],
      customerId: 'c1',
      serviceCategory: 'grooming',
    });
    expect(context.commerceModel).toBe('marketplace');
    expect(context.transactionType).toBe('booking');
    expect(context.domain).toBe(DiscountDomain.SERVICE);
    expect(context.amount).toBe(1200);
  });

  it('stamps marketplace cart from ecommerce cart mapper', () => {
    const context = vendorCartPromotionsToDiscountContext(
      [],
      [{ productId: 'p1', quantity: 1, price: 499 }],
      { vendorId: 'seller-1', customerId: 'buyer-1' }
    );
    expect(context.commerceModel).toBe('marketplace');
    expect(context.transactionType).toBe('cart');
    expect(context.domain).toBe(DiscountDomain.ECOMMERCE);
    expect(context.amount).toBe(499);
  });

  it('represents WPay Pay Bill without changing commercial quote math', () => {
    const context = payBillRequestToDiscountContext({
      vendorId: 'v-pay',
      customerId: 'c-pay',
      amount: 2000,
    });
    expect(context.commerceModel).toBe('warmpawz_pay');
    expect(context.transactionType).toBe('pay_bill');
    expect(context.amount).toBe(2000);

    const quote = computeWpayDiscountQuote(2000, 10);
    expect(quote.discountAmount).toBe(200);
    expect(quote.payableAmount).toBe(1800);
  });

  it('represents WPay Appointment without enabling evaluation', () => {
    const context = appointmentRequestToDiscountContext({
      vendorId: 'v-appt',
      customerId: 'c-appt',
      amount: 199,
    });
    expect(context.commerceModel).toBe('warmpawz_pay');
    expect(context.transactionType).toBe('appointment');
    expect(context.amount).toBe(199);
  });

  it('rejects an invalid commerce model', () => {
    expect(() => assertCommerceModelId('appointment')).toThrow(/Invalid commerce model/);
    expect(() => assertCommerceModelId('WPAY_APPOINTMENT')).toThrow(/Invalid commerce model/);
    expect(() =>
      applyDiscountCommerceContext(
        { domain: DiscountDomain.SERVICE, trigger: DiscountTrigger.AUTO, amount: 1 },
        'appointment' as never,
        'booking'
      )
    ).toThrow(/Invalid commerce model/);
  });

  it('reads Commerce Switch without selecting a different promotion engine', async () => {
    mockActiveModel('marketplace');
    expect(await resolveDiscountCommerceModelFromSwitch()).toBe('marketplace');

    mockActiveModel('warmpawz_pay');
    expect(await resolveDiscountCommerceModelFromSwitch()).toBe('warmpawz_pay');

    const marketplaceResolver = getUnifiedDiscountResolver();
    const wpayResolver = getUnifiedDiscountResolver();
    expect(wpayResolver).toBe(marketplaceResolver);
  });

  it('keeps computeWpayCommercialQuote as the WPay D < C owner', () => {
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
    expect(ok.servicePayableAmount).toBe(900);
  });

  it('does not make Appointment promotions authoritative; WPay quote stays commercially authoritative', () => {
    const root = join(__dirname, '..', '..', '..');
    const quoteResolver = readFileSync(
      join(root, 'endpoints/customer/warmpawz-pay/shared/wpay-quote-resolver.ts'),
      'utf8'
    );
    const bookingCreate = readFileSync(
      join(root, 'endpoints/booking/endpoints/bookings-enhanced.booking.ts'),
      'utf8'
    );
    expect(quoteResolver).toContain('computeWpayCommercialQuote');
    expect(quoteResolver).toContain('scheduleWpayPayBillShadow');
    expect(quoteResolver).not.toContain('commitResolverUsageEntries');
    expect(bookingCreate).toContain('wapptAppointmentFee == null');
    expect(bookingCreate).toContain('scheduleWapptAppointmentShadow');
    expect(bookingCreate).not.toContain('commitResolverUsageEntries');
  });
});
