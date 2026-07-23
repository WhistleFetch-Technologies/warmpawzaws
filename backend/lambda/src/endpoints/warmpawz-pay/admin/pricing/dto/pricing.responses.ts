import type { PricingDiscountType, PricingStatus } from '../../../constants/merchant-pricing';
import type { PricingSuccessResponse } from './pricing.errors';

export interface PricingDetailDTO {
  readonly pricingId: string;
  readonly vendorId: string;
  readonly merchantName: string;
  readonly businessName: string;
  readonly category: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly updatedAt: string;
  readonly catalogueId: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface DisablePricingResultDTO {
  readonly disabled: true;
  readonly vendorId: string;
}

export type PricingDetailSuccessResponse = PricingSuccessResponse<PricingDetailDTO>;
export type DisablePricingSuccessResponse = PricingSuccessResponse<DisablePricingResultDTO>;
