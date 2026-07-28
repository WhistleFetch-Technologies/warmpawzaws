import type { CatalogueAuditAction } from '../../constants/catalogue-audit-actions';

export interface CatalogueAuditRecord {
  readonly auditId: string;
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly action: CatalogueAuditAction;
  readonly performedBy: string;
  readonly performedAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly oldValue?: Readonly<Record<string, unknown>>;
  readonly newValue?: Readonly<Record<string, unknown>>;
}

export interface CreateCatalogueAuditInput {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly action: CatalogueAuditAction;
  readonly performedBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly oldValue?: Readonly<Record<string, unknown>>;
  readonly newValue?: Readonly<Record<string, unknown>>;
}

export interface CatalogueAuditHistoryFilters {
  readonly catalogueId: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly actions?: readonly CatalogueAuditAction[];
}

export interface ICatalogueAuditRepository {
  insert(input: CreateCatalogueAuditInput): Promise<CatalogueAuditRecord>;

  /**
   * Reserved for future audit history APIs — not implemented in Phase 9 persistence.
   */
  // getAuditHistory(filters: CatalogueAuditHistoryFilters): Promise<readonly CatalogueAuditRecord[]>;
  // listAuditEvents(filters: CatalogueAuditHistoryFilters): Promise<readonly CatalogueAuditRecord[]>;
  // filterAuditEvents(filters: CatalogueAuditHistoryFilters): Promise<readonly CatalogueAuditRecord[]>;
}
