import {
  PricingAuditAction,
  type PricingDiscountType,
  type PricingStatus,
} from '../../../constants/merchant-pricing';
import type { IPricingAuditRepository } from '../../../repositories/interfaces/IPricingAuditRepository';
import type { PricingRow } from '../../../repositories/interfaces/IMerchantPricingRepository';
import { PricingAuditPersistenceError } from '../../../repositories/pricing-audit.repository';
import { pricingAuditRepository } from '../../../repositories/pricing-audit.repository';

export interface PricingAuditEntity {
  readonly pricingId: string;
  readonly vendorId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
}

function buildEntitySnapshot(entity: PricingAuditEntity): Record<string, unknown> {
  return {
    discount_type: entity.discountType,
    discount_value: entity.discountValue,
    status: entity.status,
    effective_from: entity.effectiveFrom.toISOString(),
    effective_until: entity.effectiveUntil ? entity.effectiveUntil.toISOString() : null,
  };
}

export function toPricingAuditEntity(row: PricingRow): PricingAuditEntity {
  return {
    pricingId: row.id,
    vendorId: row.vendorId,
    discountType: row.discountType,
    discountValue: row.discountValue,
    status: row.status,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
  };
}

export class PricingAuditService {
  constructor(
    private readonly auditRepository: IPricingAuditRepository = pricingAuditRepository,
  ) {}

  async logCreated(entry: PricingAuditEntity, adminUserId: string): Promise<void> {
    await this.persist({
      action: PricingAuditAction.CREATE,
      entry,
      adminUserId,
      newValue: buildEntitySnapshot(entry),
    });
  }

  async logUpdated(
    previous: PricingAuditEntity,
    current: PricingAuditEntity,
    adminUserId: string,
  ): Promise<void> {
    await this.persist({
      action: PricingAuditAction.UPDATE,
      entry: current,
      adminUserId,
      oldValue: buildEntitySnapshot(previous),
      newValue: buildEntitySnapshot(current),
    });
  }

  async logEnabled(current: PricingAuditEntity, adminUserId: string): Promise<void> {
    await this.persist({
      action: PricingAuditAction.ENABLE,
      entry: current,
      adminUserId,
      newValue: buildEntitySnapshot(current),
    });
  }

  async logDisabled(previous: PricingAuditEntity, adminUserId: string): Promise<void> {
    await this.persist({
      action: PricingAuditAction.DISABLE,
      entry: previous,
      adminUserId,
      oldValue: buildEntitySnapshot(previous),
      newValue: { status: 'disabled' },
    });
  }

  async logDeleted(previous: PricingAuditEntity, adminUserId: string): Promise<void> {
    await this.persist({
      action: PricingAuditAction.DELETE,
      entry: previous,
      adminUserId,
      oldValue: buildEntitySnapshot(previous),
    });
  }

  private async persist(params: {
    readonly action: PricingAuditAction;
    readonly entry: PricingAuditEntity;
    readonly adminUserId: string;
    readonly oldValue?: Record<string, unknown>;
    readonly newValue?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditRepository.insert({
        pricingId: params.entry.pricingId,
        vendorId: params.entry.vendorId,
        action: params.action,
        performedBy: params.adminUserId,
        oldValue: params.oldValue,
        newValue: params.newValue,
      });
    } catch (error) {
      if (error instanceof PricingAuditPersistenceError) {
        throw error;
      }
      throw new PricingAuditPersistenceError('Failed to write pricing audit record', error);
    }
  }
}

export { PricingAuditPersistenceError };
