/** Local eligibility simulation for Bindushree M promo (no deploy). */
const row = {
  id: 'afad8a9c-18e4-4fd1-b22f-856ed0483480',
  vendor_id: 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c',
  name: '25% Off on services',
  code: null,
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: '25.00',
  min_booking_value: null,
  max_discount_amount: null,
  start_date: '2026-07-06T00:00:00.000Z',
  end_date: '2026-08-05T00:00:00.000Z',
  is_active: true,
  usage_limit: 10,
  usage_count: 0,
  target_audience: 'all',
  applicable_services: ['3c6801e4-dd44-4d86-8a2e-06218368c5ff', '85ae725a-a5e5-4fc3-9491-f6992a462610'],
  applicable_service_styles: ['all'],
};

async function main() {
  process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'SHADOW';
  process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'SHADOW';
  process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE = 'OFF';

  const mod = await import('../backend/lambda/src/utils/service-promotion-engine.ts');
  const promo = mod.normalizeServicePromotionRow(row);
  const ctx = {
    vendorId: row.vendor_id,
    serviceIds: ['3c6801e4-dd44-4d86-8a2e-06218368c5ff'],
    serviceStyle: 'at_center',
    bookingAmount: 899,
    priorVendorBookingCount: 0,
  };
  console.log('promo.applicable_services', promo.applicable_services);
  console.log('eligible', mod.isServicePromotionEligible(promo, ctx));
  console.log('eval', mod.evaluateServicePromotionDiscount(promo, ctx));
  console.log('best', mod.calculateBestBookingPromotion([promo], ctx));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
