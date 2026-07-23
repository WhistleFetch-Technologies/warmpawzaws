import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { toOptionalAdminActorUuid } from '../admin/catalogue/utils/admin-actor-id';
import { PRICING_AUDIT_ENTITY_TYPE, type PricingAuditAction } from '../constants/merchant-pricing';
import type { ICatalogueDbClient } from './interfaces/ICatalogueDbClient';
import type {
  CreatePricingAuditInput,
  IPricingAuditRepository,
  PricingAuditRecord,
} from './interfaces/IPricingAuditRepository';

const ENTITY_AUDIT_LOG_TABLE = 'entity_audit_log';

export class PricingAuditPersistenceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'PricingAuditPersistenceError';
  }
}

interface EntityAuditLogDbRow {
  readonly id: string;
  readonly entity_id: string;
  readonly action: string;
  readonly old_values: Record<string, unknown> | null;
  readonly new_values: Record<string, unknown> | null;
  readonly actor_id: string | null;
  readonly event_timestamp: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function extractVendorId(newValues: Record<string, unknown> | undefined): string {
  const vendorId = newValues?.vendor_id;
  return typeof vendorId === 'string' ? vendorId : '';
}

function extractMetadata(newValues: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!newValues) {
    return undefined;
  }
  const metadata = newValues.metadata;
  return parseJsonObject(metadata);
}

function mapAuditRow(row: EntityAuditLogDbRow): PricingAuditRecord {
  const newValues = parseJsonObject(row.new_values);
  const oldValues = parseJsonObject(row.old_values);

  return {
    auditId: row.id,
    pricingId: row.entity_id,
    vendorId: extractVendorId(newValues),
    action: row.action as PricingAuditAction,
    performedBy: row.actor_id ?? '',
    performedAt: toDate(row.event_timestamp),
    metadata: extractMetadata(newValues),
    oldValue: oldValues,
    newValue: newValues,
  };
}

function buildNewValues(input: CreatePricingAuditInput): Record<string, unknown> {
  return {
    vendor_id: input.vendorId,
    ...(input.newValue ?? {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

function calculateChangedFields(
  oldValue: Record<string, unknown> | undefined,
  newValue: Record<string, unknown>,
): string[] | null {
  const keys = new Set([...Object.keys(oldValue ?? {}), ...Object.keys(newValue)]);
  const changed = [...keys].filter(
    (key) => JSON.stringify(oldValue?.[key]) !== JSON.stringify(newValue[key]),
  );
  return changed.length > 0 ? changed : null;
}

export class PricingAuditRepository implements IPricingAuditRepository {
  constructor(private readonly db: ICatalogueDbClient = { query }) {}

  async insert(input: CreatePricingAuditInput): Promise<PricingAuditRecord> {
    const newValues = buildNewValues(input);
    const changedFields = calculateChangedFields(input.oldValue, newValues);

    const sql = `
      INSERT INTO ${ENTITY_AUDIT_LOG_TABLE} (
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        changed_fields,
        actor_id,
        actor_type,
        event_timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING
        id,
        entity_id,
        action,
        old_values,
        new_values,
        actor_id,
        event_timestamp
    `;

    try {
      const result: QueryResult<EntityAuditLogDbRow> = await this.db.query(sql, [
        PRICING_AUDIT_ENTITY_TYPE,
        input.pricingId,
        input.action,
        input.oldValue ? JSON.stringify(input.oldValue) : null,
        JSON.stringify(newValues),
        changedFields,
        toOptionalAdminActorUuid(input.performedBy),
        'admin',
      ]);

      const row = result.rows[0];
      if (!row) {
        throw new PricingAuditPersistenceError('Audit insert did not return a row');
      }

      return mapAuditRow(row);
    } catch (error) {
      if (error instanceof PricingAuditPersistenceError) {
        throw error;
      }
      throw new PricingAuditPersistenceError('Failed to persist pricing audit record', error);
    }
  }
}

export const pricingAuditRepository = new PricingAuditRepository();
