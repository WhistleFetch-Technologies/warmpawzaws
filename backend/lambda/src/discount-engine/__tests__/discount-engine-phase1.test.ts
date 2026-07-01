import { DiscountDomain } from '../enums/discount-domain';
import { DiscountTrigger } from '../enums/discount-trigger';
import { normalizePromotionRow, type CartLineItem } from '../../utils/vendor-promotion-engine';
import { createLegacyEcommerceCartDiscountCalculator } from '../adapters/legacy-ecommerce-cart-discount-calculator.adapter';
import { METADATA_PROMOTION_ROWS } from '../adapters/context-mappers';
import { mapLegacyServiceResult } from '../adapters/context-mappers';
import { createCompositeDiscountCalculator } from '../adapters/composite-discount-calculator';
import type { DiscountContext } from '../models/discount-context';
import type { DiscountCalculator } from '../contracts/discount-calculator';
import type { DiscountEngineResult } from '../models/discount-result';
import { emptyDiscountEngineResult } from '../models/discount-result';

describe('discount-engine Phase 1', () => {
  it('maps legacy service discount result to DiscountEngineResult', () => {
    const context: DiscountContext = {
      domain: DiscountDomain.SERVICE,
      trigger: DiscountTrigger.AUTO,
      amount: 1000,
      vendorId: 'v1',
    };

    const mapped = mapLegacyServiceResult(
      {
        originalAmount: 1000,
        vendorDiscountAmount: 100,
        platformDiscountAmount: 50,
        couponDiscountAmount: 0,
        totalDiscountAmount: 150,
        finalAmount: 850,
        appliedDiscounts: [
          {
            id: 'vd1',
            type: 'vendor',
            name: 'Vendor 10%',
            discountType: 'percentage',
            discountValue: 10,
            discountAmount: 100,
            order: 1,
          },
        ],
      },
      context
    );

    expect(mapped.totalSavings).toBe(150);
    expect(mapped.finalAmount).toBe(850);
    expect(mapped.applied[0].legacySource).toBe('vendor');
  });

  it('ecommerce adapter delegates to vendor-promotion-engine without changing math', async () => {
    const lines: CartLineItem[] = [
      { productId: 'p1', quantity: 2, price: 100, categoryId: 'Toys' },
    ];
    const promo = normalizePromotionRow({
      id: 'promo-1',
      name: '10% off',
      promotion_type: 'flash_sale',
      discount_type: 'percentage',
      discount_value: 10,
      start_date: '2020-01-01T00:00:00.000Z',
      end_date: '2099-12-31T23:59:59.999Z',
      is_active: true,
    } as Record<string, unknown>);

    const adapter = createLegacyEcommerceCartDiscountCalculator();
    const context: DiscountContext = {
      domain: DiscountDomain.ECOMMERCE,
      trigger: DiscountTrigger.AUTO,
      amount: 200,
      items: [{ id: 'p1', productId: 'p1', quantity: 2, unitPrice: 100 }],
      metadata: {
        [METADATA_PROMOTION_ROWS]: [promo],
        cartLines: lines,
      },
    };

    const result = await adapter.calculate(context);
    expect(result.totalSavings).toBe(20);
    expect(result.finalAmount).toBe(180);
    expect(result.applied[0].id).toBe('promo-1');
  });

  it('composite calculator routes to first supporting adapter', async () => {
    const stub: DiscountCalculator = {
      name: 'stub-service',
      supports: (ctx) => ctx.domain === DiscountDomain.SERVICE,
      calculate: async (ctx) => ({
        ...emptyDiscountEngineResult(ctx.amount),
        messages: ['stub'],
      }),
    };

    const composite = createCompositeDiscountCalculator([
      stub,
      createLegacyEcommerceCartDiscountCalculator(),
    ]);

    const serviceResult = await composite.calculate({
      domain: DiscountDomain.SERVICE,
      trigger: DiscountTrigger.AUTO,
      amount: 500,
      vendorId: 'v1',
    });
    expect(serviceResult.messages).toContain('stub');

    const unsupported = await composite.calculate({
      domain: DiscountDomain.PHARMACY,
      trigger: DiscountTrigger.AUTO,
      amount: 100,
    });
    expect(unsupported.warnings.length).toBeGreaterThan(0);
  });
});
