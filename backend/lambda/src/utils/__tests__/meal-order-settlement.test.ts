import { describe, expect, it } from 'vitest';
import { computeMealVendorSettlementAmounts } from '../meal-order-settlement';

describe('computeMealVendorSettlementAmounts', () => {
  it('commissions 20% on vendor meal subtotal only (customer fees excluded from net)', () => {
    const amounts = computeMealVendorSettlementAmounts(
      {
        subtotal: 800,
        total_amount: 964,
        delivery_fee: 99,
        platform_fee: 25,
        convenience_fee: 0,
      },
      20,
    );

    expect(amounts).not.toBeNull();
    expect(amounts!.vendorMealAmount).toBe(800);
    expect(amounts!.commissionAmount).toBe(160);
    expect(amounts!.netPayout).toBe(640);
    expect(amounts!.deliveryFee).toBe(99);
    expect(amounts!.platformFee).toBe(25);
  });
});
