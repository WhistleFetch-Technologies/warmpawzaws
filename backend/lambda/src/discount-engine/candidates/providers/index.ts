export * from './types';
export { PlatformPromotionCandidateProvider } from './platform-promotion.provider';
export { VendorPromotionCandidateProvider } from './vendor-promotion.provider';
export { VendorServicePromotionCandidateProvider } from './vendor-service-promotion.provider';
export { CouponCandidateProvider } from './coupon.provider';

import { CouponCandidateProvider } from './coupon.provider';
import { PlatformPromotionCandidateProvider } from './platform-promotion.provider';
import { VendorPromotionCandidateProvider } from './vendor-promotion.provider';
import { VendorServicePromotionCandidateProvider } from './vendor-service-promotion.provider';
import type { CandidateProvider } from './types';

export function getDefaultCandidateProviders(): CandidateProvider[] {
  return [
    new PlatformPromotionCandidateProvider(),
    new VendorPromotionCandidateProvider(),
    new VendorServicePromotionCandidateProvider(),
    new CouponCandidateProvider(),
  ];
}
