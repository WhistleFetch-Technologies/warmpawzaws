import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isAbandonedCheckoutBooking,
  sqlCountsTowardBookingMetrics,
  sqlIsAbandonedCheckout,
} from '../booking-cancellation-metrics';

const srcRoot = join(__dirname, '../..');

describe('abandoned checkout cancellations', () => {
  it('treats expired payment holds and failed checkouts as abandoned, not real cancellations', () => {
    expect(isAbandonedCheckoutBooking({ status: 'cancelled', cancellation_reason: 'payment_window_expired' })).toBe(true);
    expect(isAbandonedCheckoutBooking({ status: 'cancelled', cancellation_reason: 'Payment abandoned' })).toBe(true);
    expect(isAbandonedCheckoutBooking({ status: 'cancelled', cancellation_reason: 'razorpay_payment_failed' })).toBe(true);
  });

  it('keeps customer, vendor and admin cancellations as real cancellations', () => {
    expect(isAbandonedCheckoutBooking({ status: 'cancelled', cancellation_reason: 'Change of plans' })).toBe(false);
    expect(isAbandonedCheckoutBooking({ status: 'cancelled', cancellation_reason: null })).toBe(false);
    expect(isAbandonedCheckoutBooking({ status: 'confirmed', cancellation_reason: 'payment_window_expired' })).toBe(false);
  });

  it('builds alias-aware SQL', () => {
    expect(sqlIsAbandonedCheckout('b')).toContain("b.status = 'cancelled'");
    expect(sqlIsAbandonedCheckout('b')).toContain("'payment_window_expired'");
    expect(sqlIsAbandonedCheckout()).toContain("(status = 'cancelled'");
    expect(sqlCountsTowardBookingMetrics('b')).toMatch(/^NOT \(b\.status/);
  });

  it('is applied to admin and vendor cancellation metrics', () => {
    for (const file of [
      'endpoints/admin/endpoints/admin-customer-endpoints.ts',
      'endpoints/admin/endpoints/admin-advanced.ts',
      'endpoints/admin/endpoints/admin-comprehensive.ts',
      'endpoints/admin/endpoints/analytics.admin.ts',
      'endpoints/reports.ts',
      'endpoints/vendor/endpoints/vendorAnalytics.vendor.ts',
      'endpoints/vendor/endpoints/vendor-dashboard-enhanced.ts',
    ]) {
      expect(readFileSync(join(srcRoot, file), 'utf8')).toContain('sqlCountsTowardBookingMetrics(');
    }
  });
});

describe('wallet ledger queries match live wallet_transactions schema', () => {
  it('never filters wallet_transactions by a booking_id column (absent on dev/prod)', () => {
    for (const file of ['utils/booking-wallet-capture.ts', 'utils/payments/finalize-captured-payment.ts']) {
      const src = readFileSync(join(srcRoot, file), 'utf8');
      expect(src).not.toMatch(/OR booking_id = \$1::uuid/);
      expect(src).not.toMatch(/^\s*booking_id = \$1::uuid\s*$/m);
    }
  });
});
