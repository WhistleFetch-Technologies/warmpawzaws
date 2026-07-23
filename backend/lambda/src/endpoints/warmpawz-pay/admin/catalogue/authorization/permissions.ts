/** Read-only catalogue admin access. */
export const WPAY_CATALOGUE_VIEW = 'admin.warmpawz_pay.catalogue.view';

/** Create catalogue draft entries. */
export const WPAY_CATALOGUE_CREATE = 'admin.warmpawz_pay.catalogue.create';

/** Delete catalogue entries. */
export const WPAY_CATALOGUE_DELETE = 'admin.warmpawz_pay.catalogue.delete';

/** Publish catalogue entries. */
export const WPAY_CATALOGUE_PUBLISH = 'admin.warmpawz_pay.catalogue.publish';

/** Unpublish catalogue entries. */
export const WPAY_CATALOGUE_UNPUBLISH = 'admin.warmpawz_pay.catalogue.unpublish';

/** Bulk publish, unpublish, and delete operations. */
export const WPAY_CATALOGUE_BULK = 'admin.warmpawz_pay.catalogue.bulk';

/** Legacy MVP permission — grants full catalogue admin capability. */
export const WPAY_LEGACY_FULL_ACCESS = 'admin.warmpawz_pay';

export const WPAY_CATALOGUE_PERMISSIONS = {
  VIEW: WPAY_CATALOGUE_VIEW,
  CREATE: WPAY_CATALOGUE_CREATE,
  DELETE: WPAY_CATALOGUE_DELETE,
  PUBLISH: WPAY_CATALOGUE_PUBLISH,
  UNPUBLISH: WPAY_CATALOGUE_UNPUBLISH,
  BULK: WPAY_CATALOGUE_BULK,
} as const;

export type WpayCataloguePermissionId =
  (typeof WPAY_CATALOGUE_PERMISSIONS)[keyof typeof WPAY_CATALOGUE_PERMISSIONS];

const LEGACY_READ_PERMISSION = 'admin.warmpawz_pay.catalogue.read';
const LEGACY_WRITE_PERMISSION = 'admin.warmpawz_pay.catalogue.write';

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWpayCataloguePermission(
  permissions: readonly string[],
  required: WpayCataloguePermissionId,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }

  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }

  if (permissions.includes(LEGACY_WRITE_PERMISSION)) {
    return true;
  }

  if (permissions.includes(LEGACY_READ_PERMISSION) && required === WPAY_CATALOGUE_VIEW) {
    return true;
  }

  return permissions.includes(required);
}
