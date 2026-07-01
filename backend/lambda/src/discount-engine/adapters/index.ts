export { LegacyServiceDiscountCalculatorAdapter, createLegacyServiceDiscountCalculator } from './legacy-service-discount-calculator.adapter';
export { LegacyEcommerceCartDiscountCalculatorAdapter, createLegacyEcommerceCartDiscountCalculator } from './legacy-ecommerce-cart-discount-calculator.adapter';
export { CompositeDiscountCalculator, createCompositeDiscountCalculator } from './composite-discount-calculator';
export {
  METADATA_PROMOTION_ROWS,
  METADATA_PRIOR_VENDOR_ORDER_COUNT,
  contextItemsToCartLines,
  serviceContextToLegacyParams,
  ecommerceContextToLegacyEvaluateContext,
  parseLegacyBookingCalculateRequest,
  bookingCalculateRequestToDiscountContext,
  resolveBookingParamsToDiscountContext,
  discountContextToResolveBookingParams,
  mapLegacyServiceResult,
  isServiceDomain,
  isEcommerceDomain,
} from './context-mappers';
export type { LegacyBookingCalculateRequest } from './context-mappers';
