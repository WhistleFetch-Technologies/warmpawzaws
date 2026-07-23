import type {
  BusinessTypeFilter,
  CustomerVisibleFilter,
  MerchantSortField,
  PlatformStatusFilter,
  SortOrder,
  WarmpawzPayStatusFilter,
} from '../../constants/merchant-limits';
import type { PublishStatus } from '../../constants/publish-status';

export interface MerchantAdminRow {
  readonly id: string;
  readonly vendorId: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendorStatus: string;
  readonly payBillEnabled: boolean;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly isActive: boolean;
  readonly isOnline: boolean;
  readonly vendorType: string | null;
  readonly isSoloProvider: boolean;
  readonly legacyCategory: string | null;
  readonly roleName: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
}

export interface MerchantAdminFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: MerchantSortField;
  readonly sortOrder: SortOrder;
  readonly q?: string;
  readonly category?: string;
  readonly businessType?: BusinessTypeFilter;
  readonly platformStatus?: PlatformStatusFilter;
  readonly warmpawzPayStatus?: WarmpawzPayStatusFilter;
  readonly customerVisible?: CustomerVisibleFilter;
}

export interface IMerchantAdminRepository {
  listMerchants(filters: MerchantAdminFilters): Promise<readonly MerchantAdminRow[]>;

  countMerchants(filters: MerchantAdminFilters): Promise<number>;
}
