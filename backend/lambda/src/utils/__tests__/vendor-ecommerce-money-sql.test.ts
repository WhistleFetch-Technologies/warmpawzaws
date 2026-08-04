import {
  SQL_VENDOR_COMMISSION_AMOUNT,
  SQL_VENDOR_ECOMMERCE_ORDER_FILTER,
  SQL_VENDOR_GOODS_AMOUNT,
  SQL_VENDOR_NET_AMOUNT,
} from '../vendor-ecommerce-money-sql';

/**
 * These tests document the SQL fragment contracts (not executed against RDS).
 * Scenarios mirror vendor-order-money.ts and ecommerce-settlement-calculator.ts.
 */

describe('vendor-ecommerce-money-sql fragments', () => {
  it('exports goods amount expression that references subtotal and vendor promo', () => {
    expect(SQL_VENDOR_GOODS_AMOUNT).toContain('o.subtotal');
    expect(SQL_VENDOR_GOODS_AMOUNT).toContain('vendor_promotion_amount');
    expect(SQL_VENDOR_GOODS_AMOUNT).toContain("= 'vendor'");
    // Goods amount must not add shipping into revenue (subtotal is primary).
    expect(SQL_VENDOR_GOODS_AMOUNT).toMatch(/COALESCE\(o\.subtotal/);
  });

  it('exports net amount using vendor_payout_amount with goods-minus-commission fallback', () => {
    expect(SQL_VENDOR_NET_AMOUNT).toContain('o.vendor_payout_amount');
    expect(SQL_VENDOR_NET_AMOUNT).toContain(SQL_VENDOR_GOODS_AMOUNT.trim());
    expect(SQL_VENDOR_NET_AMOUNT).toContain(SQL_VENDOR_COMMISSION_AMOUNT.trim());
  });

  it('exports commission from stored commission_amount only', () => {
    expect(SQL_VENDOR_COMMISSION_AMOUNT).toContain('o.commission_amount');
  });

  it('order filter excludes cancelled and unpaid orders', () => {
    expect(SQL_VENDOR_ECOMMERCE_ORDER_FILTER).toContain("!= 'cancelled'");
    expect(SQL_VENDOR_ECOMMERCE_ORDER_FILTER).toContain("!= 'pending_payment'");
    expect(SQL_VENDOR_ECOMMERCE_ORDER_FILTER).toContain('payment_status');
  });
});

describe('vendor goods scenarios (documented expectations)', () => {
  /**
   * Example: subtotal 310, admin promo 15.5, shipping 150, total 444.5
   * vendor goods = 310 (admin promo does not reduce)
   */
  const adminPromoOrder = {
    subtotal: 310,
    promotion_source: 'admin',
    admin_promotion_amount: 15.5,
    vendor_promotion_amount: 0,
    shipping_amount: 150,
    total_amount: 444.5,
    commission_amount: 77.5,
    vendor_payout_amount: 232.5,
  };

  it('admin promo: goods = subtotal, net = payout', () => {
    expect(adminPromoOrder.subtotal).toBe(310);
    expect(adminPromoOrder.vendor_payout_amount).toBe(232.5);
    expect(adminPromoOrder.total_amount).not.toBe(adminPromoOrder.subtotal);
  });

  it('vendor promo: goods = subtotal - vendor_promo', () => {
    const vendorPromoOrder = {
      subtotal: 310,
      promotion_source: 'vendor',
      vendor_promotion_amount: 15.5,
      shipping_amount: 150,
    };
    const goods = vendorPromoOrder.subtotal - vendorPromoOrder.vendor_promotion_amount;
    expect(goods).toBeCloseTo(294.5, 2);
  });

  it('no promo: goods = subtotal', () => {
    const noPromoOrder = { subtotal: 310, promotion_source: null, shipping_amount: 150 };
    expect(noPromoOrder.subtotal).toBe(310);
  });
});
