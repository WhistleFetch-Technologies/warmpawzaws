import { DRAFT, PUBLISHED } from '../../../constants/publish-status';
import { withTransaction } from '../../../../../database/rds-connection';
import { CatalogueErrorCode } from '../dto/catalogue.errors';
import type { CreateCatalogueRequest, CatalogueListQuery, VendorCandidatesQuery } from '../dto/catalogue.requests';
import type {
  BulkOperationResponse,
  BulkOperationResultItem,
  CatalogueDetail,
  CatalogueListData,
  CatalogueListItem,
  EligibilityDTO,
  VendorCandidateDTO,
  VendorCandidateListData,
} from '../dto/catalogue.responses';
import type { IVendorCatalogRepository, CatalogueRowWithVendor } from '../../../repositories/interfaces/IVendorCatalogRepository';
import type {
  IVendorEligibilityRepository,
  VendorCandidateRow,
} from '../../../repositories/interfaces/IVendorEligibilityRepository';
import { CatalogueRepositoryError } from '../../../repositories/vendor-catalog.repository';
import { CatalogueAuditPersistenceError } from '../../../repositories/catalogue-audit.repository';
import { toAuditEntity } from './catalogue-audit.service';
import { createCatalogueTransactionContext } from './catalogue-transaction.context';
import type { IVendorEligibilityService } from './interfaces/IVendorEligibilityService';
import type { VendorEligibilitySnapshot } from '../../../repositories/interfaces/IVendorEligibilityRepository';

export class CatalogueAdminError extends Error {
  readonly code: CatalogueErrorCode;

  constructor(code: CatalogueErrorCode, message: string) {
    super(message);
    this.name = 'CatalogueAdminError';
    this.code = code;
  }
}

export interface DeleteEntryResult {
  readonly deleted: true;
}

interface ResolvedEligibility {
  readonly eligibility: EligibilityDTO;
  readonly warnings: readonly string[];
}

export class VendorCatalogAdminService {
  constructor(
    private readonly catalogRepository: IVendorCatalogRepository,
    private readonly eligibilityRepository: IVendorEligibilityRepository,
    private readonly eligibilityService: IVendorEligibilityService,
  ) {}

  async createEntry(
    input: CreateCatalogueRequest,
    adminUserId: string,
  ): Promise<CatalogueDetail> {
    const vendorExistence = await this.eligibilityRepository.assertVendorExists(input.vendorId);
    if (!vendorExistence) {
      throw new CatalogueAdminError(
        CatalogueErrorCode.VENDOR_NOT_FOUND,
        'Vendor not found',
      );
    }
    if (vendorExistence.isDeleted) {
      throw new CatalogueAdminError(
        CatalogueErrorCode.VENDOR_DELETED,
        'Vendor is deleted',
      );
    }
    if (await this.catalogRepository.existsForVendor(input.vendorId)) {
      throw new CatalogueAdminError(
        CatalogueErrorCode.DUPLICATE_CATALOGUE_ENTRY,
        'Vendor already has a catalogue entry',
      );
    }

    let inserted;
    try {
      inserted = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const row = await catalogRepository.insertDraft(input.vendorId, adminUserId);
        await auditService.logCreated(toAuditEntity(row), adminUserId);
        return row;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    const entry = await this.catalogRepository.findById(inserted.id);
    if (!entry) {
      throw new CatalogueAdminError(
        CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND,
        'Catalogue entry not found after creation',
      );
    }

    const resolved = this.resolveEligibility(entry);
    return this.buildCatalogueDetail(entry, resolved);
  }

  async getEntry(catalogueId: string): Promise<CatalogueDetail | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }
    const resolved = this.resolveEligibility(entry);
    return this.buildCatalogueDetail(entry, resolved);
  }

  async listEntries(query: CatalogueListQuery): Promise<CatalogueListData> {
    const filters = {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      publishStatus: query.publishStatus,
      eligibility: query.eligibility,
      q: query.q,
      city: query.city,
      vendorId: query.vendorId,
    };

    const [rows, total] = await Promise.all([
      this.catalogRepository.listAdmin(filters),
      this.catalogRepository.countAdmin(filters),
    ]);

    const items = rows.map((row) => this.buildCatalogueListItem(row, this.resolveEligibility(row)));

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async searchVendorCandidates(query: VendorCandidatesQuery): Promise<VendorCandidateListData> {
    const filters = {
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
    };

    const [rows, total] = await Promise.all([
      this.eligibilityRepository.searchCandidates(filters),
      this.eligibilityRepository.countCandidates(filters),
    ]);

    return {
      items: rows.map((row) => this.mapVendorCandidate(row)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async publish(catalogueId: string, adminUserId: string): Promise<CatalogueDetail | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    const resolved = this.resolveEligibility(entry);
    if (entry.publishStatus === PUBLISHED) {
      return this.buildCatalogueDetail(entry, resolved);
    }

    const oldStatus = entry.publishStatus;
    let refreshed;
    try {
      refreshed = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const updated = await catalogRepository.updatePublishStatus({
          catalogueId,
          publishStatus: PUBLISHED,
          publishedAt: new Date(),
        });
        if (!updated) {
          return null;
        }

        const row = await catalogRepository.findById(catalogueId);
        if (!row) {
          return null;
        }

        await auditService.logPublished(toAuditEntity(row), adminUserId, { oldStatus });
        return row;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!refreshed) {
      return null;
    }

    const refreshedResolved = this.resolveEligibility(refreshed);
    return this.buildCatalogueDetail(refreshed, refreshedResolved);
  }

  async unpublish(catalogueId: string, adminUserId: string): Promise<CatalogueDetail | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    const resolved = this.resolveEligibility(entry);
    if (entry.publishStatus === DRAFT) {
      return this.buildCatalogueDetail(entry, resolved);
    }

    let refreshed;
    try {
      refreshed = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const updated = await catalogRepository.updatePublishStatus({
          catalogueId,
          publishStatus: DRAFT,
          publishedAt: null,
        });
        if (!updated) {
          return null;
        }

        const row = await catalogRepository.findById(catalogueId);
        if (!row) {
          return null;
        }

        await auditService.logUnpublished(toAuditEntity(row), adminUserId);
        return row;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!refreshed) {
      return null;
    }

    const refreshedResolved = this.resolveEligibility(refreshed);
    return this.buildCatalogueDetail(refreshed, refreshedResolved);
  }

  async deleteEntry(
    catalogueId: string,
    adminUserId: string,
  ): Promise<DeleteEntryResult | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    let deleted = false;
    try {
      deleted = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const removed = await catalogRepository.deleteById(catalogueId);
        if (!removed) {
          return false;
        }

        await auditService.logDeleted(toAuditEntity(entry), adminUserId);
        return true;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!deleted) {
      return null;
    }

    return { deleted: true };
  }

  async bulkPublish(catalogueIds: readonly string[], adminUserId: string): Promise<BulkOperationResponse> {
    return this.runBulkOperation(catalogueIds, (catalogueId) =>
      this.publishForBulk(catalogueId, adminUserId),
    );
  }

  async bulkUnpublish(
    catalogueIds: readonly string[],
    adminUserId: string,
  ): Promise<BulkOperationResponse> {
    return this.runBulkOperation(catalogueIds, (catalogueId) =>
      this.unpublishForBulk(catalogueId, adminUserId),
    );
  }

  async bulkDelete(catalogueIds: readonly string[], adminUserId: string): Promise<BulkOperationResponse> {
    const results: BulkOperationResultItem[] = [];

    for (const catalogueId of catalogueIds) {
      try {
        const outcome = await this.deleteForBulk(catalogueId, adminUserId);
        if (!outcome) {
          results.push(
            this.buildBulkFailure(
              catalogueId,
              CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND,
              'Catalogue entry not found',
            ),
          );
          continue;
        }
        results.push({ catalogueId, success: true });
      } catch (error) {
        results.push(this.buildBulkFailureFromError(catalogueId, error));
      }
    }

    return this.buildBulkResponse(catalogueIds.length, results);
  }

  private async publishForBulk(
    catalogueId: string,
    adminUserId: string,
  ): Promise<CatalogueDetail | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    const resolved = this.resolveEligibility(entry);
    if (entry.publishStatus === PUBLISHED) {
      return this.buildCatalogueDetail(entry, resolved);
    }

    const oldStatus = entry.publishStatus;
    let refreshed;
    try {
      refreshed = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const updated = await catalogRepository.updatePublishStatus({
          catalogueId,
          publishStatus: PUBLISHED,
          publishedAt: new Date(),
        });
        if (!updated) {
          return null;
        }

        const row = await catalogRepository.findById(catalogueId);
        if (!row) {
          return null;
        }

        await auditService.logBulkPublished([toAuditEntity(row)], adminUserId, { oldStatus });
        return row;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!refreshed) {
      return null;
    }

    return this.buildCatalogueDetail(refreshed, this.resolveEligibility(refreshed));
  }

  private async unpublishForBulk(
    catalogueId: string,
    adminUserId: string,
  ): Promise<CatalogueDetail | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    const resolved = this.resolveEligibility(entry);
    if (entry.publishStatus === DRAFT) {
      return this.buildCatalogueDetail(entry, resolved);
    }

    let refreshed;
    try {
      refreshed = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const updated = await catalogRepository.updatePublishStatus({
          catalogueId,
          publishStatus: DRAFT,
          publishedAt: null,
        });
        if (!updated) {
          return null;
        }

        const row = await catalogRepository.findById(catalogueId);
        if (!row) {
          return null;
        }

        await auditService.logBulkUnpublished([toAuditEntity(row)], adminUserId);
        return row;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!refreshed) {
      return null;
    }

    return this.buildCatalogueDetail(refreshed, this.resolveEligibility(refreshed));
  }

  private async deleteForBulk(
    catalogueId: string,
    adminUserId: string,
  ): Promise<DeleteEntryResult | null> {
    const entry = await this.catalogRepository.findById(catalogueId);
    if (!entry) {
      return null;
    }

    let deleted = false;
    try {
      deleted = await withTransaction(async (client) => {
        const { catalogRepository, auditService } = createCatalogueTransactionContext(client);
        const removed = await catalogRepository.deleteById(catalogueId);
        if (!removed) {
          return false;
        }

        await auditService.logBulkDeleted([toAuditEntity(entry)], adminUserId);
        return true;
      });
    } catch (error) {
      throw this.mapMutationError(error);
    }

    if (!deleted) {
      return null;
    }

    return { deleted: true };
  }

  private resolveEligibility(row: CatalogueRowWithVendor): ResolvedEligibility {
    const snapshot = this.toEligibilitySnapshot(row);
    return {
      eligibility: this.eligibilityService.buildEligibilityDto(snapshot),
      warnings: this.eligibilityService.buildWarnings(snapshot),
    };
  }

  private toEligibilitySnapshot(row: CatalogueRowWithVendor): VendorEligibilitySnapshot {
    return {
      vendorId: row.vendorId,
      businessName: row.businessName,
      ownerName: row.ownerName,
      city: row.city,
      phone: row.phone,
      vendorStatus: row.vendorStatus,
      payBillEnabled: row.payBillEnabled,
      bankVerified: row.bankVerified,
      isDeleted: row.isDeleted,
    };
  }

  private buildCatalogueListItem(
    row: CatalogueRowWithVendor,
    resolved: ResolvedEligibility,
  ): CatalogueListItem {
    return {
      catalogueId: row.id,
      vendorId: row.vendorId,
      businessName: row.businessName,
      ownerName: row.ownerName ?? undefined,
      city: row.city ?? undefined,
      phone: row.phone ?? undefined,
      publishStatus: row.publishStatus,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy,
      eligibility: resolved.eligibility,
      warnings: resolved.warnings.length > 0 ? resolved.warnings : undefined,
    };
  }

  private buildCatalogueDetail(
    row: CatalogueRowWithVendor,
    resolved: ResolvedEligibility,
  ): CatalogueDetail {
    return this.buildCatalogueListItem(row, resolved);
  }

  private mapVendorCandidate(row: VendorCandidateRow): VendorCandidateDTO {
    return {
      vendorId: row.vendorId,
      businessName: row.businessName,
      city: row.city,
      status: row.status,
      payBillEnabled: row.payBillEnabled,
      bankVerified: row.bankVerified,
    };
  }

  private async runBulkOperation(
    catalogueIds: readonly string[],
    operation: (catalogueId: string) => Promise<CatalogueDetail | null>,
  ): Promise<BulkOperationResponse> {
    const results: BulkOperationResultItem[] = [];

    for (const catalogueId of catalogueIds) {
      try {
        const outcome = await operation(catalogueId);
        if (!outcome) {
          results.push(
            this.buildBulkFailure(
              catalogueId,
              CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND,
              'Catalogue entry not found',
            ),
          );
          continue;
        }
        results.push({ catalogueId, success: true });
      } catch (error) {
        results.push(this.buildBulkFailureFromError(catalogueId, error));
      }
    }

    return this.buildBulkResponse(catalogueIds.length, results);
  }

  private buildBulkResponse(
    requested: number,
    results: readonly BulkOperationResultItem[],
  ): BulkOperationResponse {
    const succeeded = results.filter((result) => result.success).length;
    return {
      requested,
      succeeded,
      failed: requested - succeeded,
      results,
    };
  }

  private buildBulkFailure(
    catalogueId: string,
    code: CatalogueErrorCode,
    message: string,
  ): BulkOperationResultItem {
    return {
      catalogueId,
      success: false,
      error: { code, message },
    };
  }

  private buildBulkFailureFromError(
    catalogueId: string,
    error: unknown,
  ): BulkOperationResultItem {
    if (error instanceof CatalogueAdminError) {
      return this.buildBulkFailure(catalogueId, error.code, error.message);
    }
    if (error instanceof CatalogueRepositoryError) {
      return this.buildBulkFailure(catalogueId, error.code, error.message);
    }
    if (error instanceof CatalogueAuditPersistenceError) {
      return this.buildBulkFailure(
        catalogueId,
        CatalogueErrorCode.VALIDATION_ERROR,
        error.message,
      );
    }
    return this.buildBulkFailure(
      catalogueId,
      CatalogueErrorCode.VALIDATION_ERROR,
      'Unexpected error during bulk operation',
    );
  }

  private mapMutationError(error: unknown): never {
    if (error instanceof CatalogueRepositoryError) {
      throw new CatalogueAdminError(error.code, error.message);
    }
    if (error instanceof CatalogueAuditPersistenceError) {
      throw error;
    }
    throw error;
  }
}
