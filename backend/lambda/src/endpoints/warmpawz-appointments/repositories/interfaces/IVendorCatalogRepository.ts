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
  readonly appointmentFee: number;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Admin unified list row — approved vendor with optional catalogue entry. */
export interface CatalogueAdminListRow {
  readonly inCatalogue: boolean;
  readonly id: string | null;
  readonly vendorId: string;
  readonly appointmentFee: number | null;
  readonly publishStatus: PublishStatus | null;
  readonly publishedAt: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
  readonly vendorUpdatedAt: Date;
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendorStatus: string;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly isActive: boolean;
  readonly isOnline: boolean;
  readonly vendorType: string | null;
  readonly isSoloProvider: boolean;
  readonly legacyCategory: string | null;
  readonly roleName: string | null;
  readonly roleDisplayName: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
}

export interface CatalogueRowWithVendor extends CatalogueRow {
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendorStatus: string;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly isActive: boolean;
  readonly isOnline: boolean;
  readonly vendorType: string | null;
  readonly isSoloProvider: boolean;
  readonly legacyCategory: string | null;
  readonly roleName: string | null;
  readonly roleDisplayName: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
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
  readonly serviceCategory?: string;
  /** @deprecated Use serviceCategory (launch id slug). */
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
  readonly appointmentFee: number;
}

export interface UpdatePublishStatusParams {
  readonly catalogueId: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
}

export interface InsertDraftParams {
  readonly vendorId: string;
  readonly createdBy: string | null;
  readonly appointmentFee?: number;
}

export interface UpdateAppointmentFeeParams {
  readonly catalogueId: string;
  readonly appointmentFee: number;
}

export interface IVendorCatalogRepository {
  insertDraft(params: InsertDraftParams): Promise<CatalogueRow>;

  updatePublishStatus(params: UpdatePublishStatusParams): Promise<CatalogueRow | null>;

  updateAppointmentFee(params: UpdateAppointmentFeeParams): Promise<CatalogueRow | null>;

  deleteById(catalogueId: string): Promise<boolean>;

  findById(catalogueId: string): Promise<CatalogueRowWithVendor | null>;

  findByVendorId(vendorId: string): Promise<CatalogueRow | null>;

  existsForVendor(vendorId: string): Promise<boolean>;

  listAdmin(filters: CatalogueAdminFilters): Promise<readonly CatalogueAdminListRow[]>;

  countAdmin(filters: CatalogueAdminFilters): Promise<number>;

  listPublishedEligible(
    filters: PublishedEligibleFilters,
  ): Promise<readonly PublishedVendorRow[]>;
}
