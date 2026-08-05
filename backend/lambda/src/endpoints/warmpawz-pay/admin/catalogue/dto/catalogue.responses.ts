import type { PublishStatus } from '../../../constants/publish-status';
import type { PricingDiscountType, PricingStatus } from '../../../constants/merchant-pricing';
import type { MerchantBusinessType } from '../../../shared/merchant/merchant-business-type.resolver';
import type { PlatformStatus } from '../../../shared/merchant/merchant-platform-status.resolver';
import type { MerchantReadinessDTO } from '../../../shared/merchant/merchant-readiness.service';
import type { WarmpawzPayStatus } from '../../../shared/merchant/merchant-warmpawz-pay-status.resolver';

export interface EligibilityDTO {
  readonly bankVerified: boolean;
  readonly vendorStatus: string;
  readonly customerVisible: boolean;
}

export interface CataloguePricingSummary {
  readonly configured: boolean;
  readonly pricingId?: string;
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly platformWithholdPercent?: number;
  readonly status?: PricingStatus;
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string | null;
}

export interface CatalogueListItem {
  readonly catalogueId: string | null;
  readonly inCatalogue: boolean;
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName?: string;
  readonly city?: string;
  readonly phone?: string;
  readonly publishStatus: PublishStatus | null;
  readonly publishedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly createdBy: string | null;
  readonly eligibility: EligibilityDTO;
  readonly warnings?: readonly string[];
  readonly category: string;
  readonly serviceCategory: string;
  readonly serviceCategoryId: string;
  readonly roleLabel: string;
  readonly categoryDisplay: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadinessDTO;
  readonly pricing: CataloguePricingSummary;
}

export interface CatalogueAuditSummaryItem {
  readonly action: string;
  readonly actorId: string | null;
  readonly occurredAt: string;
}

export interface CatalogueDetail extends CatalogueListItem {
  readonly auditSummary?: readonly CatalogueAuditSummaryItem[];
}

export interface VendorCandidateDTO {
  readonly vendorId: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly status: string;
  readonly bankVerified: boolean;
  readonly category: string;
  readonly serviceCategory: string;
  readonly serviceCategoryId: string;
  readonly roleLabel: string;
  readonly categoryDisplay: string;
  readonly platformStatus: PlatformStatus;
}

export interface ServiceCategoryOptionDTO {
  readonly id: string;
  readonly label: string;
}

export interface PaginationResponse {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface BulkOperationResultItem {
  readonly catalogueId: string;
  readonly success: boolean;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface BulkOperationResponse {
  readonly requested: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: readonly BulkOperationResultItem[];
}

export interface SuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}

export interface CatalogueListData {
  readonly items: readonly CatalogueListItem[];
  readonly pagination: PaginationResponse;
}

export interface VendorCandidateListData {
  readonly items: readonly VendorCandidateDTO[];
  readonly pagination: PaginationResponse;
}

export type CatalogueListResponse = SuccessResponse<CatalogueListData>;
export type CatalogueDetailResponse = SuccessResponse<CatalogueDetail>;
export type VendorCandidateListResponse = SuccessResponse<VendorCandidateListData>;
export type ServiceCategoryListResponse = SuccessResponse<readonly ServiceCategoryOptionDTO[]>;
export type BulkOperationSuccessResponse = SuccessResponse<BulkOperationResponse>;
