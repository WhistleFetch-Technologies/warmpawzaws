import type { MerchantBusinessType } from '../../../shared/merchant/merchant-business-type.resolver';
import type { PlatformStatus } from '../../../shared/merchant/merchant-platform-status.resolver';
import type {
  MerchantReadinessDTO,
  ReadinessCheck,
} from '../../../shared/merchant/merchant-readiness.service';
import type { WarmpawzPayStatus } from '../../../shared/merchant/merchant-warmpawz-pay-status.resolver';

export type { ReadinessCheck, MerchantReadinessDTO };

export interface MerchantListItemDTO {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly readiness: MerchantReadinessDTO;
  readonly customerVisible: boolean;
  readonly updatedAt: string;
}

export interface MerchantPaginationDTO {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface MerchantListDataDTO {
  readonly items: readonly MerchantListItemDTO[];
  readonly pagination: MerchantPaginationDTO;
}

export interface MerchantListSuccessResponse {
  readonly success: true;
  readonly data: MerchantListDataDTO;
}
