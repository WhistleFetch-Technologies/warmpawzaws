/**
 * Warmpawz Pay vendor catalogue — persisted audit action values.
 */
export const CatalogueAuditAction = {
  CREATE: 'create',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  DELETE: 'delete',
  BULK_PUBLISH: 'bulk_publish',
  BULK_UNPUBLISH: 'bulk_unpublish',
  BULK_DELETE: 'bulk_delete',
} as const;

export type CatalogueAuditAction =
  (typeof CatalogueAuditAction)[keyof typeof CatalogueAuditAction];

export const CATALOGUE_AUDIT_ENTITY_TYPE = 'warmpawz_pay_vendor_catalog' as const;
