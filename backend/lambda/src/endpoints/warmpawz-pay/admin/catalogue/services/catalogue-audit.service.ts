import type { PublishStatus } from '../../../constants/publish-status';
import type { CatalogueRow, CatalogueRowWithVendor } from '../../../repositories/interfaces/IVendorCatalogRepository';

/**
 * Minimal catalogue entity passed to audit methods.
 * Full persistence is intentionally deferred — see Phase 9.
 */
export interface CatalogueAuditEntity {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: Date | null;
  readonly createdBy: string | null;
}

export interface CatalogueAuditMetadata {
  readonly [key: string]: unknown;
}

export interface CataloguePublishedAuditMetadata extends CatalogueAuditMetadata {
  readonly oldStatus: PublishStatus;
}

function toAuditEntity(row: CatalogueRow | CatalogueRowWithVendor): CatalogueAuditEntity {
  return {
    catalogueId: row.id,
    vendorId: row.vendorId,
    publishStatus: row.publishStatus,
    publishedAt: row.publishedAt,
    createdBy: row.createdBy,
  };
}

/**
 * Catalogue audit abstraction.
 *
 * Real audit persistence (e.g. `entity_audit_log` / `admin_audit_log` inserts)
 * will be implemented in Phase 9. Until then, all methods are safe no-ops.
 */
export class CatalogueAuditService {
  async logCreated(
    _entry: CatalogueAuditEntity,
    _adminUserId: string,
    _metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    // Phase 9: persist audit record for catalogue creation.
  }

  async logPublished(
    _entry: CatalogueAuditEntity,
    _adminUserId: string,
    _metadata?: CataloguePublishedAuditMetadata,
  ): Promise<void> {
    // Phase 9: persist audit record for publish transition.
  }

  async logUnpublished(
    _entry: CatalogueAuditEntity,
    _adminUserId: string,
    _metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    // Phase 9: persist audit record for unpublish transition.
  }

  async logDeleted(
    _entry: CatalogueAuditEntity,
    _adminUserId: string,
    _metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    // Phase 9: persist audit record for catalogue deletion.
  }
}

export { toAuditEntity };
