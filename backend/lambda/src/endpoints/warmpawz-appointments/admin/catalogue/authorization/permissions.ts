/** Read-only catalogue admin access. */
export const WAPPT_CATALOGUE_VIEW = 'admin.warmpawz_appointments.catalogue.view';

/** Create catalogue draft entries. */
export const WAPPT_CATALOGUE_CREATE = 'admin.warmpawz_appointments.catalogue.create';

/** Delete catalogue entries. */
export const WAPPT_CATALOGUE_DELETE = 'admin.warmpawz_appointments.catalogue.delete';

/** Publish catalogue entries. */
export const WAPPT_CATALOGUE_PUBLISH = 'admin.warmpawz_appointments.catalogue.publish';

/** Unpublish catalogue entries. */
export const WAPPT_CATALOGUE_UNPUBLISH = 'admin.warmpawz_appointments.catalogue.unpublish';

/** Bulk publish, unpublish, and delete operations. */
export const WAPPT_CATALOGUE_BULK = 'admin.warmpawz_appointments.catalogue.bulk';

/** Update appointment fee (single row and bulk-fee). */
export const WAPPT_CATALOGUE_FEE_WRITE = 'admin.warmpawz_appointments.catalogue.fee.write';

/** Legacy MVP permission — grants full catalogue admin capability. */
export const WAPPT_LEGACY_FULL_ACCESS = 'admin.warmpawz_appointments';

export const WAPPT_CATALOGUE_PERMISSIONS = {
  VIEW: WAPPT_CATALOGUE_VIEW,
  CREATE: WAPPT_CATALOGUE_CREATE,
  DELETE: WAPPT_CATALOGUE_DELETE,
  PUBLISH: WAPPT_CATALOGUE_PUBLISH,
  UNPUBLISH: WAPPT_CATALOGUE_UNPUBLISH,
  BULK: WAPPT_CATALOGUE_BULK,
  FEE_WRITE: WAPPT_CATALOGUE_FEE_WRITE,
} as const;

export type WapptCataloguePermissionId =
  (typeof WAPPT_CATALOGUE_PERMISSIONS)[keyof typeof WAPPT_CATALOGUE_PERMISSIONS];

const LEGACY_READ_PERMISSION = 'admin.warmpawz_appointments.catalogue.read';
const LEGACY_WRITE_PERMISSION = 'admin.warmpawz_appointments.catalogue.write';

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWapptCataloguePermission(
  permissions: readonly string[],
  required: WapptCataloguePermissionId,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }

  if (permissions.includes(WAPPT_LEGACY_FULL_ACCESS)) {
    return true;
  }

  if (permissions.includes(LEGACY_WRITE_PERMISSION)) {
    return true;
  }

  if (permissions.includes(LEGACY_READ_PERMISSION) && required === WAPPT_CATALOGUE_VIEW) {
    return true;
  }

  return permissions.includes(required);
}
