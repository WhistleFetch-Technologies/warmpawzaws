import {
  buildWpayIdempotencyKey,
  normalizeWpayClientRequestId,
  WpayPaymentAlreadyCompletedError,
} from '../wpay-razorpay-order';

describe('wpay idempotency key', () => {
  it('is stable for the same customer, vendor, and clientRequestId', () => {
    const a = buildWpayIdempotencyKey({
      customerId: 'cust-1',
      vendorId: 'vend-1',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
    });
    const b = buildWpayIdempotencyKey({
      customerId: 'cust-1',
      vendorId: 'vend-1',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when clientRequestId changes (same quoted amount day no longer blocks)', () => {
    const first = buildWpayIdempotencyKey({
      customerId: 'cust-1',
      vendorId: 'vend-1',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
    });
    const second = buildWpayIdempotencyKey({
      customerId: 'cust-1',
      vendorId: 'vend-1',
      clientRequestId: '22222222-2222-4222-8222-222222222222',
    });
    expect(first).not.toBe(second);
  });

  it('normalizes valid UUID clientRequestId and mints one when missing', () => {
    expect(
      normalizeWpayClientRequestId('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'),
    ).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    const minted = normalizeWpayClientRequestId('');
    expect(minted).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('exposes completed conflict error for initiate 409 mapping', () => {
    const err = new WpayPaymentAlreadyCompletedError('pay-1');
    expect(err.paymentId).toBe('pay-1');
    expect(err.message).toMatch(/already completed/i);
  });
});
