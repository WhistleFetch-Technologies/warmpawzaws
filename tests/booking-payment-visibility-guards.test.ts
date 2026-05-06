import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('booking/payment visibility guards', () => {
  test('booking created event is not published for pending_payment drafts', () => {
    const file = read('backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain("if (booking.status !== 'pending_payment')");
    expect(file).toContain('publishBookingCreated');
  });

  test('payment-abandoned fallback cancel suppresses vendor-facing cancel signals', () => {
    const file = read('backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    expect(file).toContain('suppressVendorFacingCancelSignals');
    expect(file).toContain("!suppressVendorFacingCancelSignals");
    expect(file).toContain("if (currentBooking.vendor_id && !suppressVendorFacingCancelSignals)");
  });

  test('vendor booking list routes consistently hide pending_payment rows', () => {
    const file = read('backend/lambda/src/endpoints/vendor/endpoints/vendor-bookings.ts');
    expect(file).toContain("AND status != 'pending_payment'");
    expect(file).toContain("AND b.status != 'pending_payment'");
  });

  test('admin operational booking reads exclude pending_payment rows', () => {
    const file = read('backend/lambda/src/endpoints/admin/endpoints/admin-comprehensive.ts');
    expect(file).toContain("COUNT(*) FILTER (WHERE status <> 'pending_payment') as total_bookings");
    expect(file).toContain("AND b.status <> 'pending_payment'");
  });

  test('admin bookings/activity endpoints hide unpaid drafts', () => {
    const controller = read('backend/lambda/src/endpoints/admin/endpoints/admin.controller.ts');
    expect(controller).toContain("WHERE b.status <> 'pending_payment'");
    expect(controller).toContain("LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')");

    const advanced = read('backend/lambda/src/endpoints/admin/endpoints/admin-advanced.ts');
    expect(advanced).toContain("AND b.status <> 'pending_payment'");
    expect(advanced).toContain("LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')");
  });
});
