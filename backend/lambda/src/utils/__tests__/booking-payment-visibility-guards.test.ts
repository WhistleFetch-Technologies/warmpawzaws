import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('booking/payment visibility guards', () => {
  test('booking created event is not published for pending_payment drafts', () => {
    const file = read('src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain("if (booking.status !== 'pending_payment')");
    expect(file).toContain('publishBookingCreated');
  });

  test('payment-abandoned fallback cancel suppresses vendor-facing cancel signals', () => {
    const file = read('src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain('suppressVendorFacingCancelSignals');
    expect(file).toContain("!suppressVendorFacingCancelSignals");
    expect(file).toContain("if (currentBooking.vendor_id && !suppressVendorFacingCancelSignals)");
    expect(file).toContain('isPaymentWindowExpiredReason');
  });

  test('payment hold endpoints and slot SQL are wired', () => {
    const file = read('src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain('payment_hold_expires_at');
    expect(file).toContain('process-payment-hold-expiry');
    expect(file).toContain('payment-resume');
    expect(file).toContain('SQL_BOOKING_BLOCKS_SLOT');
  });

  test('vendor booking list routes consistently hide pending_payment rows', () => {
    const file = read('src/endpoints/vendor/endpoints/vendor-bookings.ts');
    expect(file).toContain("b.status != 'pending_payment'");
  });

  test('admin operational booking reads exclude pending_payment rows', () => {
    const file = read('src/endpoints/admin/endpoints/admin-comprehensive.ts');
    expect(file).toContain("COUNT(*) FILTER (WHERE status <> 'pending_payment') as total_bookings");
    expect(file).toContain("AND b.status <> 'pending_payment'");
  });
});
