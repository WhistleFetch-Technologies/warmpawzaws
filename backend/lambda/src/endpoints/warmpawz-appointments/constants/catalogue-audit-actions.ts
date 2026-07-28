/**
 * Warmpawz Appointments vendor catalogue — persisted audit action values.
 */
export const CatalogueAuditAction = {
  CREATE: 'create',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  DELETE: 'delete',
  FEE_UPDATE: 'fee_update',
  BULK_PUBLISH: 'bulk_publish',
  BULK_UNPUBLISH: 'bulk_unpublish',
  BULK_DELETE: 'bulk_delete',
  BULK_FEE_UPDATE: 'bulk_fee_update',
} as const;

export type CatalogueAuditAction =
  (typeof CatalogueAuditAction)[keyof typeof CatalogueAuditAction];

export const CATALOGUE_AUDIT_ENTITY_TYPE = 'warmpawz_appointments_vendor_catalog' as const;
