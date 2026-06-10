import { describe, expect, it } from 'vitest';

/** Mirrors shop-order-notifications dedupe key contract (stable for cron retries). */
function shopDedupeKey(orderId: string, event: string, recipientType: 'customer' | 'vendor'): string {
  return `shop-order-${orderId}-${event}-${recipientType}`;
}

describe('shop-order notification dedupe keys', () => {
  it('uses stable keys per order, event, and recipient', () => {
    const orderId = '11111111-1111-1111-1111-111111111111';
    expect(shopDedupeKey(orderId, 'paid', 'customer')).toBe(
      `shop-order-${orderId}-paid-customer`
    );
    expect(shopDedupeKey(orderId, 'shipped', 'customer')).toBe(
      `shop-order-${orderId}-shipped-customer`
    );
    expect(shopDedupeKey(orderId, 'paid-vendor', 'vendor')).toBe(
      `shop-order-${orderId}-paid-vendor-vendor`
    );
  });

  it('separates customer and vendor keys for the same lifecycle event', () => {
    const orderId = '22222222-2222-2222-2222-222222222222';
    const customer = shopDedupeKey(orderId, 'cancelled', 'customer');
    const vendor = shopDedupeKey(orderId, 'cancelled-vendor', 'vendor');
    expect(customer).not.toBe(vendor);
  });
});
