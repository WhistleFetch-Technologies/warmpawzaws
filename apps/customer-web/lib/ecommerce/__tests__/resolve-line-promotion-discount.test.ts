import { resolveLinePromotionDiscount } from '../cart-product-helpers';

describe('resolveLinePromotionDiscount', () => {
  it('keeps a vendor promo on that product and leaves the other at full MRP', () => {
    const glenand = resolveLinePromotionDiscount({
      lineId: 'collar',
      productId: 'collar',
      lineMrp: 792,
      orderMrp: 1952,
      orderDiscount: 118.8,
      lineDiscounts: [
        { productId: 'collar', lineKey: 'collar', discount: 118.8 },
        { productId: 'meal', lineKey: 'meal', discount: 0 },
      ],
    });
    const meal = resolveLinePromotionDiscount({
      lineId: 'meal',
      productId: 'meal',
      lineMrp: 1160,
      orderMrp: 1952,
      orderDiscount: 118.8,
      lineDiscounts: [
        { productId: 'collar', lineKey: 'collar', discount: 118.8 },
        { productId: 'meal', lineKey: 'meal', discount: 0 },
      ],
    });

    expect(glenand).toBe(118.8);
    expect(meal).toBe(0);
    expect(792 - glenand).toBeCloseTo(673.2, 2);
    expect(1160 - meal).toBe(1160);
  });
});
