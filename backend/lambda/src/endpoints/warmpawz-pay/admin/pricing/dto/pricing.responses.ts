import type { PricingDiscountType, PricingStatus } from '../../../constants/merchant-pricing';
import type { PricingSuccessResponse } from './pricing.errors';

export interface PricingListItemDTO {
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
}

export interface PricingDetailDTO extends PricingListItemDTO {
  readonly catalogueId: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface PaginationDTO {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PricingListDataDTO {
  readonly items: readonly PricingListItemDTO[];
  readonly pagination: PaginationDTO;
}

export interface DisablePricingResultDTO {
  readonly disabled: true;
  readonly vendorId: string;
}

export type PricingListSuccessResponse = PricingSuccessResponse<PricingListDataDTO>;
export type PricingDetailSuccessResponse = PricingSuccessResponse<PricingDetailDTO>;
export type DisablePricingSuccessResponse = PricingSuccessResponse<DisablePricingResultDTO>;
