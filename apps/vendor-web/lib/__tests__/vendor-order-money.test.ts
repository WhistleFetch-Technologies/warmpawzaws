import { resolveVendorOrderMoney } from '../vendor-order-money';

describe('resolveVendorOrderMoney', () => {
  it('keeps full catalog as settlement base for admin/platform promotions', () => {
    const money = resolveVendorOrderMoney({
      subtotal: 162,
      shipping_amount: 150,
      tax_amount: 24.71,
      total_amount: 295.8,
      discount_amount: 16.2,
      promotion_source: 'admin',
      admin_promotion_amount: 16.2,
      vendor_promotion_amount: 0,
      commission_amount: 10,
      vendor_payout_amount: 152,
    });

    expect(money.isPlatformFunded).toBe(true);
    expect(money.isVendorFunded).toBe(false);
    expect(money.catalogSubtotal).toBe(162);
    expect(money.vendorGoodsAmount).toBe(162);
    expect(money.customerPaid).toBe(295.8);
    expect(money.discountAmount).toBe(16.2);
    expect(money.vendorPayoutAmount).toBe(152);
  });

  it('reduces vendor goods when vendor funds the promotion', () => {
    const money = resolveVendorOrderMoney({
      subtotal: 162,
      shipping_amount: 150,
      total_amount: 295.8,
      discount_amount: 16.2,
      promotion_source: 'vendor',
      vendor_promotion_amount: 16.2,
      admin_promotion_amount: 0,
      commission_amount: 10,
    });

    expect(money.isVendorFunded).toBe(true);
    expect(money.vendorGoodsAmount).toBeCloseTo(145.8, 5);
    expect(money.vendorPayoutAmount).toBeCloseTo(135.8, 5);
  });

  it('infers admin funding from admin_promotion_amount when source is missing', () => {
    const money = resolveVendorOrderMoney({
      subtotal: 162,
      total_amount: 295.8,
      admin_promotion_amount: 16.2,
      vendor_promotion_amount: 0,
    });
    expect(money.promotionSource).toBe('admin');
    expect(money.vendorGoodsAmount).toBe(162);
  });

  it('Glenand example: admin promo and shipping do not reduce vendor goods or payout base', () => {
    const money = resolveVendorOrderMoney({
      subtotal: 310,
      shipping_amount: 150,
      total_amount: 444.5,
      discount_amount: 15.5,
      promotion_source: 'admin',
      admin_promotion_amount: 15.5,
      vendor_promotion_amount: 0,
      commission_rate: 25,
      commission_amount: 77.5,
      vendor_payout_amount: 232.5,
    });

    expect(money.vendorGoodsAmount).toBe(310);
    expect(money.customerPaid).toBe(444.5);
    expect(money.shipping).toBe(150);
    expect(money.isPlatformFunded).toBe(true);
    expect(money.vendorPayoutAmount).toBe(232.5);
    expect(money.vendorGoodsAmount).not.toBe(money.customerPaid);
  });

  it('parses mixed commission snapshot lines', () => {
    const money = resolveVendorOrderMoney({
      subtotal: 310,
      commission_rate: 8.6,
      commission_amount: 26.65,
      commission_snapshot: {
        lineBreakdown: [
          {
            productId: 'p1',
            rate: 7,
            commission: 14.77,
            source: 'vendor_own_brand',
            listingOwnership: 'own_brand',
          },
          {
            productId: 'p2',
            rate: 12,
            commission: 11.88,
            source: 'vendor_third_party',
            listingOwnership: 'third_party',
          },
        ],
      },
      items: [{ product_id: 'p1', name: 'Whiskas' }],
    });

    expect(money.hasMixedCommissionRates).toBe(true);
    expect(money.commissionLines).toHaveLength(2);
    expect(money.commissionLines[0]?.label).toContain('Whiskas');
  });
});
