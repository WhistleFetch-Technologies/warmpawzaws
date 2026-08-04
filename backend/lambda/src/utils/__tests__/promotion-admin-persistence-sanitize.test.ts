import {
  buildEcommerceAdminPromotionRecord,
  buildPromotionPersistenceFromAdminBody,
  coerceAdminBodyForEcommercePersistence,
  sanitizePromotionsTablePayload,
} from '../promotion-admin-persistence';

describe('sanitizePromotionsTablePayload', () => {
  it('maps min_order_value to min_order_amount and strips aliases', () => {
    const out = sanitizePromotionsTablePayload({
      name: 'Test',
      min_order_value: 100,
      discountType: 'percentage',
      validFrom: '2026-07-01',
      selected_targets: { categories: ['vet'] },
      discount_value: 10,
    });
    expect(out.min_order_amount).toBe(100);
    expect(out.min_order_value).toBeUndefined();
    expect(out.discountType).toBeUndefined();
    expect(out.validFrom).toBeUndefined();
    expect(out.selected_targets).toBeUndefined();
    expect(out.name).toBe('Test');
    expect(out.discount_value).toBe(10);
  });

  it('keeps existing min_order_amount when both present', () => {
    const out = sanitizePromotionsTablePayload({
      min_order_amount: 50,
      min_order_value: 100,
    });
    expect(out.min_order_amount).toBe(50);
    expect(out.min_order_value).toBeUndefined();
  });
});

describe('ecommerce admin targeting persistence', () => {
  const wizardBody = {
    name: 'Introductory Offer',
    discount_type: 'percentage',
    discount_value: 5,
    valid_from: '2026-07-20',
    valid_until: '2026-08-23',
    discount_domain: 'ECOMMERCE',
    listing_ownership_scope: 'third_party',
    target_scopes: ['vendors', 'products'],
    selected_targets: {
      vendors: ['vendor-1'],
      products: ['prod-a', 'prod-b', 'prod-c'],
    },
    applicable_products: ['prod-a', 'prod-b', 'prod-c'],
    is_active: true,
  };

  it('persists third_party scope and product ids from wizard body', () => {
    const row = buildEcommerceAdminPromotionRecord(wizardBody);
    expect(row.listing_ownership_scope).toBe('third_party');
    expect(JSON.parse(String(row.applicable_products))).toEqual([
      'prod-a',
      'prod-b',
      'prod-c',
    ]);
  });

  it('does not wipe targeting when rebuild runs on intermediate persistence record', () => {
    // Mirrors POST /admin/promotions: build once, then buildEcommerce from that record.
    const intermediate = buildPromotionPersistenceFromAdminBody(wizardBody);
    expect((intermediate.metadata as any).listingOwnershipScope).toBe('third_party');
    expect((intermediate.metadata as any).applicableProducts).toEqual([
      'prod-a',
      'prod-b',
      'prod-c',
    ]);

    const row = buildEcommerceAdminPromotionRecord({
      ...intermediate,
      discount_domain: 'ECOMMERCE',
    });
    expect(row.listing_ownership_scope).toBe('third_party');
    expect(JSON.parse(String(row.applicable_products))).toEqual([
      'prod-a',
      'prod-b',
      'prod-c',
    ]);
  });

  it('coerce lifts metadata targeting for ecommerce rebuild', () => {
    const coerced = coerceAdminBodyForEcommercePersistence({
      name: 'X',
      discount_domain: 'ECOMMERCE',
      metadata: {
        listingOwnershipScope: 'own_brand',
        applicableProducts: ['p1'],
        selectedTargets: { products: ['p1'], vendors: ['v1'] },
      },
    });
    expect(coerced.listing_ownership_scope).toBe('own_brand');
    expect(coerced.applicable_products).toEqual(['p1']);
    expect((coerced.selected_targets as any).products).toEqual(['p1']);
  });
});
