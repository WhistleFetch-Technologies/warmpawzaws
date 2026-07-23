import type {
  CatalogueEligibilityFilter,
  CataloguePublishStatusFilter,
  CatalogueSortField,
  SortOrder,
} from '../../constants/catalogue-limits';
import type { PublishStatus } from '../../constants/publish-status';

export interface CatalogueRow {
  readonly id: string;
  readonly vendorId: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CatalogueRowWithVendor extends CatalogueRow {
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
  readonly pricingId: string | null;
  readonly pricingDiscountType: string | null;
  readonly pricingDiscountValue: number | null;
  readonly pricingStatus: string | null;
  readonly pricingEffectiveFrom: Date | null;
  readonly pricingEffectiveUntil: Date | null;
}

export interface CatalogueAdminFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: CatalogueSortField;
  readonly sortOrder: SortOrder;
  readonly publishStatus?: CataloguePublishStatusFilter;
  readonly eligibility?: CatalogueEligibilityFilter;
  readonly q?: string;
  readonly city?: string;
  readonly vendorId?: string;
  readonly category?: string;
}

export interface PublishedEligibleFilters {
  readonly q?: string;
  readonly city?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface PublishedVendorRow {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly phone: string | null;
  readonly publishedAt: Date | null;
}

export interface UpdatePublishStatusParams {
  readonly catalogueId: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
}

export interface IVendorCatalogRepository {
  insertDraft(vendorId: string, createdBy: string | null): Promise<CatalogueRow>;

  updatePublishStatus(params: UpdatePublishStatusParams): Promise<CatalogueRow | null>;

  deleteById(catalogueId: string): Promise<boolean>;

  findById(catalogueId: string): Promise<CatalogueRowWithVendor | null>;

  findByVendorId(vendorId: string): Promise<CatalogueRow | null>;

  existsForVendor(vendorId: string): Promise<boolean>;

  listAdmin(filters: CatalogueAdminFilters): Promise<readonly CatalogueRowWithVendor[]>;

  countAdmin(filters: CatalogueAdminFilters): Promise<number>;

  listPublishedEligible(
    filters: PublishedEligibleFilters,
  ): Promise<readonly PublishedVendorRow[]>;
}
