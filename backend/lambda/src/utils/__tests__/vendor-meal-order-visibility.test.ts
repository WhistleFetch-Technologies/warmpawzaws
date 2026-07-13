/**
 * Documents vendor meal-orders list visibility (must match fetch-vendor-meal-orders.ts SQL).
 * Regression: Pidge-cancelled prod orders use payment_status=refunded and remain visible.
 * Unpaid checkout abandons must stay hidden from the vendor dashboard.
 */

import {
  isMealOrderVendorVisible,
} from '../shop-vendor-visibility';

describe('vendorMealOrderVisibleForDashboard', () => {
  it('includes paid and refunded Pidge-cancelled rows', () => {
    expect(isMealOrderVendorVisible({ payment_status: 'paid' })).toBe(true);
    expect(isMealOrderVendorVisible({ payment_status: 'refunded' })).toBe(true);
  });

  it('hides expired hold cancellations (never paid)', () => {
    expect(isMealOrderVendorVisible({ payment_status: 'expired' })).toBe(false);
  });

  it('hides cancelled rows when payment never captured', () => {
    expect(isMealOrderVendorVisible({ payment_status: 'pending' })).toBe(false);
    expect(isMealOrderVendorVisible({ payment_status: 'failed' })).toBe(false);
  });
});
