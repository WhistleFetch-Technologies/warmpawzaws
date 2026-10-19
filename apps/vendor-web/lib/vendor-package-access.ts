/** Package creation is available to business and solo vendors of every role. */
export function vendorCanCreatePackages(_isSoloProvider: boolean): boolean {
  return true;
}

const DELETABLE_PACKAGE_STATUSES = new Set([
  'draft',
  'rejected',
  'published',
  'auto_published',
  'pending_approval',
]);

/**
 * A new package with no bookings can be unpublished and deleted.
 * Published non-package services stay delete-hidden; the API still refuses
 * deletion when any booking already uses the row.
 */
export function vendorServiceShowsDelete(opts: {
  publishStatus?: string | null;
  isPackage?: boolean | null;
}): boolean {
  const status = String(opts.publishStatus || '').trim().toLowerCase();
  if (status === 'draft' || status === 'rejected') return true;
  if (!opts.isPackage) return false;
  return DELETABLE_PACKAGE_STATUSES.has(status);
}
