import type { PublishStatus } from '../../constants/publish-status';
import type { CatalogueEligibilityFilter } from '../../constants/catalogue-limits';

export interface VendorEligibilitySnapshot {
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendorStatus: string;
  readonly isActive: boolean;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly publishStatus?: PublishStatus;
}

export interface VendorCandidateFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly status?: string;
  readonly category?: string;
  readonly vendorId?: string;
  readonly eligibility?: Exclude<CatalogueEligibilityFilter, 'all'>;
}

export interface VendorCandidateRow {
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly vendorType: string | null;
  readonly roleName: string | null;
  readonly isSoloProvider: boolean;
  readonly city: string | null;
  readonly status: string;
  readonly isActive: boolean;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly legacyCategory: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
}

export interface VendorExistenceResult {
  readonly vendorId: string;
  readonly isDeleted: boolean;
}

export interface IVendorEligibilityRepository {
  getSnapshot(vendorId: string): Promise<VendorEligibilitySnapshot | null>;

  searchCandidates(filters: VendorCandidateFilters): Promise<readonly VendorCandidateRow[]>;

  countCandidates(filters: VendorCandidateFilters): Promise<number>;

  /**
   * Returns vendor existence for create validation.
   * `null` when the vendor row does not exist.
   */
  assertVendorExists(vendorId: string): Promise<VendorExistenceResult | null>;
}
