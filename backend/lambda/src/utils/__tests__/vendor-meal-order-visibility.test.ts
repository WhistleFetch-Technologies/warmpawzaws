/**
 * Documents vendor meal-orders list visibility (must match fetch-vendor-meal-orders.ts SQL).
 * Regression: Pidge-cancelled prod orders use payment_status=refunded and were hidden from dashboard.
 */

function vendorMealOrderVisibleForDashboard(paymentStatus: string | null, orderStatus: string | null): boolean {
  const pay = String(paymentStatus ?? '').toLowerCase();
  const st = String(orderStatus ?? '').toLowerCase();
  if (['paid', 'completed', 'refunded', 'expired'].includes(pay)) return true;
  return [
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
    'failed',
  ].includes(st);
}

describe('vendorMealOrderVisibleForDashboard', () => {
  it('includes paid and refunded Pidge-cancelled rows', () => {
    expect(vendorMealOrderVisibleForDashboard('paid', 'cancelled')).toBe(true);
    expect(vendorMealOrderVisibleForDashboard('refunded', 'cancelled')).toBe(true);
  });

  it('includes expired hold cancellations', () => {
    expect(vendorMealOrderVisibleForDashboard('expired', 'cancelled')).toBe(true);
  });

  it('includes cancelled rows even when payment never captured', () => {
    expect(vendorMealOrderVisibleForDashboard('pending', 'cancelled')).toBe(true);
  });

  it('excludes unpaid checkout holds still pending', () => {
    expect(vendorMealOrderVisibleForDashboard('pending', 'pending')).toBe(false);
  });
});
