export interface VendorEligibilitySnapshot {
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendorStatus: string;
  readonly payBillEnabled: boolean;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
}

export interface VendorCandidateFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly status?: string;
}

export interface VendorCandidateRow {
  readonly vendorId: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly status: string;
  readonly payBillEnabled: boolean;
  readonly bankVerified: boolean;
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
