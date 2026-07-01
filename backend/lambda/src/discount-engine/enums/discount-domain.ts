/**
 * Business domain a discount applies to.
 * Phase 1: SERVICE and ECOMMERCE are primary; others reserved for future lines.
 */
export enum DiscountDomain {
  SERVICE = 'SERVICE',
  ECOMMERCE = 'ECOMMERCE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  MEMBERSHIP = 'MEMBERSHIP',
  PHARMACY = 'PHARMACY',
  TELECONSULT = 'TELECONSULT',
}
