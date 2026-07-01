export { LegacyServiceDiscountCalculatorAdapter, createLegacyServiceDiscountCalculator } from './legacy-service-discount-calculator.adapter';
export { LegacyEcommerceCartDiscountCalculatorAdapter, createLegacyEcommerceCartDiscountCalculator } from './legacy-ecommerce-cart-discount-calculator.adapter';
export { CompositeDiscountCalculator, createCompositeDiscountCalculator } from './composite-discount-calculator';
export {
  METADATA_PROMOTION_ROWS,
  contextItemsToCartLines,
  serviceContextToLegacyParams,
  mapLegacyServiceResult,
  isServiceDomain,
  isEcommerceDomain,
} from './context-mappers';
