import {
  calculateBestBookingPromotion,
  calculateBookingPromotionsBestOffer,
  calculateBookingPromotionsSequentialStack,
  evaluateServicePromotionDiscount,
  normalizeServicePromotionRow,
  type ServicePromotionRow,
} from '../service-promotion-engine';

function svcPromo(
  overrides: Partial<ServicePromotionRow> & Pick<ServicePromotionRow, 'id'>
): ServicePromotionRow {
  return normalizeServicePromotionRow({
    name: 'Test offer',
    promotion_type: 'flash_sale',
    discount_type: 'percentage',
    discount_value: 10,
    start_date: '2020-01-01T00:00:00.000Z',
    end_date: '2099-12-31T23:59:59.999Z',
    is_active: true,
    ...overrides,
  } as Record<string, unknown>);
}

const baseCtx = {
  vendorId: 'vendor-1',
  customerId: 'cust-1',
  serviceIds: ['svc-a', 'svc-b'],
  serviceStyle: 'at_center',
  bookingAmount: 1000,
  priorVendorBookingCount: 0,
};

describe('service-promotion-engine', () => {
  it('rejects first_booking promo for returning customers', () => {
    const p = svcPromo({ id: 'fb', promotion_type: 'first_booking', discount_value: 20 });
    expect(
      evaluateServicePromotionDiscount(p, { ...baseCtx, priorVendorBookingCount: 1 })
    ).toBeNull();
    expect(
      evaluateServicePromotionDiscount(p, { ...baseCtx, priorVendorBookingCount: 0 })?.discountAmount
    ).toBe(200);
  });

  it('enforces min_booking_value', () => {
    const p = svcPromo({ id: 'min', min_booking_value: 1500, discount_value: 10 });
    expect(evaluateServicePromotionDiscount(p, baseCtx)).toBeNull();
    expect(
      evaluateServicePromotionDiscount(p, { ...baseCtx, bookingAmount: 2000 })?.discountAmount
    ).toBe(200);
  });

  it('filters by applicable service style', () => {
    const p = svcPromo({
      id: 'style',
      applicable_service_styles: ['tele'],
      discount_value: 15,
    });
    expect(evaluateServicePromotionDiscount(p, baseCtx)).toBeNull();
    expect(
      evaluateServicePromotionDiscount(p, { ...baseCtx, serviceStyle: 'tele' })?.discountAmount
    ).toBe(150);
  });

  it('combo requires all combo services in selection', () => {
    const combo = svcPromo({
      id: 'combo',
      promotion_type: 'combo',
      combo_services: ['svc-a', 'svc-b'],
      combo_discount: 25,
      discount_value: 0,
    });
    expect(evaluateServicePromotionDiscount(combo, baseCtx)?.discountAmount).toBe(250);

    const partial = svcPromo({
      id: 'combo-partial',
      promotion_type: 'combo',
      combo_services: ['svc-a', 'svc-c'],
      combo_discount: 25,
    });
    expect(evaluateServicePromotionDiscount(partial, baseCtx)).toBeNull();
  });

  it('calculateBestBookingPromotion picks highest auto-eligible promo', () => {
    const low = svcPromo({ id: 'low', discount_value: 5 });
    const high = svcPromo({ id: 'high', discount_value: 15 });
    const coded = svcPromo({ id: 'coded', code: 'SAVE', discount_value: 50 });
    const result = calculateBestBookingPromotion([low, high, coded], baseCtx);
    expect(result.bestPromotion?.promotionId).toBe('high');
    expect(result.totalSavings).toBe(150);
  });

  it('calculateBookingPromotionsBestOffer picks one leg — no vendor+platform stack', () => {
    const vendor80 = svcPromo({ id: 'v80', discount_value: 80 });
    const platform50 = {
      id: 'p50',
      name: 'Platform 50',
      discount_type: 'percentage',
      discount_value: 50,
    };
    const ctx = { ...baseCtx, bookingAmount: 199 };
    const best = calculateBookingPromotionsBestOffer({
      vendorPromotions: [vendor80],
      platformPromotions: [platform50],
      ctx,
    });
    expect(best.applied).toHaveLength(1);
    expect(best.applied[0]?.source).toBe('vendor');
    expect(best.finalAmount).toBeCloseTo(39.8, 1);
    expect(best.totalSavings).toBeCloseTo(159.2, 1);

    const stacked = calculateBookingPromotionsSequentialStack({
      vendorPromotions: [vendor80],
      platformPromotions: [platform50],
      ctx,
    });
    expect(stacked.applied).toHaveLength(2);
    expect(stacked.finalAmount).toBeCloseTo(19.9, 1);
  });
});
