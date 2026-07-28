import type { PublishStatus } from '../../../constants/publish-status';
import { CatalogueAuditAction } from '../../../constants/catalogue-audit-actions';
import type { CatalogueRow, CatalogueRowWithVendor } from '../../../repositories/interfaces/IVendorCatalogRepository';
import type { ICatalogueAuditRepository } from '../../../repositories/interfaces/ICatalogueAuditRepository';
import { catalogueAuditRepository } from '../../../repositories/catalogue-audit.repository';
import { CatalogueAuditPersistenceError } from '../../../repositories/catalogue-audit.repository';

export interface CatalogueAuditEntity {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly appointmentFee: number;
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

export interface CatalogueFeeUpdatedAuditMetadata extends CatalogueAuditMetadata {
  readonly oldFee: number;
  readonly newFee: number;
}

function toAuditEntity(row: CatalogueRow | CatalogueRowWithVendor): CatalogueAuditEntity {
  return {
    catalogueId: row.id,
    vendorId: row.vendorId,
    appointmentFee: row.appointmentFee,
    publishStatus: row.publishStatus,
    publishedAt: row.publishedAt,
    createdBy: row.createdBy,
  };
}

function buildEntitySnapshot(entity: CatalogueAuditEntity): Record<string, unknown> {
  return {
    appointment_fee: entity.appointmentFee,
    publish_status: entity.publishStatus,
    published_at: entity.publishedAt ? entity.publishedAt.toISOString() : null,
    created_by: entity.createdBy,
  };
}

export class CatalogueAuditService {
  constructor(
    private readonly auditRepository: ICatalogueAuditRepository = catalogueAuditRepository,
  ) {}

  async logCreated(
    entry: CatalogueAuditEntity,
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persist({
      action: CatalogueAuditAction.CREATE,
      entry,
      adminUserId,
      metadata,
      newValue: buildEntitySnapshot(entry),
    });
  }

  async logFeeUpdated(
    entry: CatalogueAuditEntity,
    adminUserId: string,
    metadata: CatalogueFeeUpdatedAuditMetadata,
  ): Promise<void> {
    await this.persist({
      action: CatalogueAuditAction.FEE_UPDATE,
      entry,
      adminUserId,
      metadata,
      oldValue: { appointment_fee: metadata.oldFee },
      newValue: { appointment_fee: metadata.newFee },
    });
  }

  async logPublished(
    entry: CatalogueAuditEntity,
    adminUserId: string,
    metadata?: CataloguePublishedAuditMetadata,
  ): Promise<void> {
    const oldStatus = metadata?.oldStatus;
    await this.persist({
      action: CatalogueAuditAction.PUBLISH,
      entry,
      adminUserId,
      metadata,
      oldValue: oldStatus
        ? {
            publish_status: oldStatus,
          }
        : undefined,
      newValue: buildEntitySnapshot(entry),
    });
  }

  async logUnpublished(
    entry: CatalogueAuditEntity,
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persist({
      action: CatalogueAuditAction.UNPUBLISH,
      entry,
      adminUserId,
      metadata,
      newValue: buildEntitySnapshot(entry),
    });
  }

  async logDeleted(
    entry: CatalogueAuditEntity,
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persist({
      action: CatalogueAuditAction.DELETE,
      entry,
      adminUserId,
      metadata,
      oldValue: buildEntitySnapshot(entry),
    });
  }

  async logBulkPublished(
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persistBulk(CatalogueAuditAction.BULK_PUBLISH, entries, adminUserId, metadata);
  }

  async logBulkUnpublished(
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persistBulk(CatalogueAuditAction.BULK_UNPUBLISH, entries, adminUserId, metadata);
  }

  async logBulkDeleted(
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    await this.persistBulk(CatalogueAuditAction.BULK_DELETE, entries, adminUserId, metadata);
  }

  async logBulkFeeUpdated(
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata: CatalogueFeeUpdatedAuditMetadata,
  ): Promise<void> {
    for (const entry of entries) {
      await this.persist({
        action: CatalogueAuditAction.BULK_FEE_UPDATE,
        entry,
        adminUserId,
        metadata,
        oldValue: { appointment_fee: metadata.oldFee },
        newValue: { appointment_fee: metadata.newFee },
      });
    }
  }

  private async persistBulk(
    action: typeof CatalogueAuditAction.BULK_PUBLISH,
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void>;
  private async persistBulk(
    action: typeof CatalogueAuditAction.BULK_UNPUBLISH,
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void>;
  private async persistBulk(
    action: typeof CatalogueAuditAction.BULK_DELETE,
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void>;
  private async persistBulk(
    action:
      | typeof CatalogueAuditAction.BULK_PUBLISH
      | typeof CatalogueAuditAction.BULK_UNPUBLISH
      | typeof CatalogueAuditAction.BULK_DELETE,
    entries: readonly CatalogueAuditEntity[],
    adminUserId: string,
    metadata?: CatalogueAuditMetadata,
  ): Promise<void> {
    for (const entry of entries) {
      await this.persist({
        action,
        entry,
        adminUserId,
        metadata,
        oldValue:
          action === CatalogueAuditAction.BULK_DELETE
            ? buildEntitySnapshot(entry)
            : undefined,
        newValue:
          action === CatalogueAuditAction.BULK_DELETE
            ? undefined
            : buildEntitySnapshot(entry),
      });
    }
  }

  private async persist(params: {
    readonly action: CatalogueAuditAction;
    readonly entry: CatalogueAuditEntity;
    readonly adminUserId: string;
    readonly metadata?: CatalogueAuditMetadata;
    readonly oldValue?: Record<string, unknown>;
    readonly newValue?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditRepository.insert({
        catalogueId: params.entry.catalogueId,
        vendorId: params.entry.vendorId,
        action: params.action,
        performedBy: params.adminUserId,
        metadata: params.metadata,
        oldValue: params.oldValue,
        newValue: params.newValue,
      });
    } catch (error) {
      if (error instanceof CatalogueAuditPersistenceError) {
        throw error;
      }
      throw new CatalogueAuditPersistenceError('Failed to write catalogue audit record', error);
    }
  }
}

export { toAuditEntity, CatalogueAuditPersistenceError };
