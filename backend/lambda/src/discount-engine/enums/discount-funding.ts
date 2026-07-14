/**
 * Who funds the discount at settlement time.
 * Phase 1: type only — settlement engine is not implemented yet.
 */
export enum DiscountFunding {
  PLATFORM = 'PLATFORM',
  VENDOR = 'VENDOR',
  SHARED = 'SHARED',
}
