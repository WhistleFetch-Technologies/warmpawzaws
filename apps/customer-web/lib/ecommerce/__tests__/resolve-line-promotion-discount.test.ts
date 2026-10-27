import type { ShopProduct } from '@/components/shop/shop-types';
import { resolveLinePromotionDiscount, shopProductToCartItem } from '../cart-product-helpers';

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

describe('shopProductToCartItem', () => {
  it('stores the listing variant id for a size product', () => {
    const product = {
      id: 'fd472bab-2974-4868-8d91-b495fa4102ac',
      name: 'Glenand Medium Bone 6 inch',
      description: '',
      category_id: 'cat',
      price: 100,
      images: [],
      rating: 0,
      review_count: 0,
      stock: 100,
      vendor_id: 'vendor',
      vendor_name: 'Glenand Group',
      is_active: true,
      has_variants: true,
      listing_sku_id: 'e50605da-b16d-44e9-924b-9bacfea11aa9',
      listing_option_values: { size: '75g' },
    } as ShopProduct;

    const item = shopProductToCartItem(product);

    expect(item.id).toBe(
      'fd472bab-2974-4868-8d91-b495fa4102ac::e50605da-b16d-44e9-924b-9bacfea11aa9',
    );
    expect(item.warmpawzLine?.product_sku_id).toBe('e50605da-b16d-44e9-924b-9bacfea11aa9');
    expect(item.warmpawzLine?.selected_variations).toEqual({ size: '75g' });
    expect(item.selectedVariations).toEqual({ size: '75g' });
  });
});
