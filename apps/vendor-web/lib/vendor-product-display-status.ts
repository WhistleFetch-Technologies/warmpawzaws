/** Vendor catalog badge / filter status derived from API `status` + `is_active`. */
export type VendorProductDisplayStatus =
  | 'active'
  | 'pending'
  | 'draft'
  | 'rejected'
  | 'inactive'
  | 'out_of_stock'
  | 'photos_uploading'
  | 'photos_retrying';

export interface VendorProductStatusFields {
  status?: string | null;
  is_active?: boolean | null;
  image_ingest_status?: string | null;
  approval_hold?: string | null;
}

function isPendingLike(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'pending_approval' ||
    status === 'submit_for_approval' ||
    status === 'submitted' ||
    !status
  );
}

function imageHoldKind(
  product: VendorProductStatusFields,
): 'photos_uploading' | 'photos_retrying' | null {
  const ingest = String(product.image_ingest_status ?? '').trim().toLowerCase();
  const hold = String(product.approval_hold ?? '').trim().toLowerCase();
  if (ingest === 'failed') return 'photos_retrying';
  if (ingest === 'processing' || hold === 'images') return 'photos_uploading';
  return null;
}

/**
 * Maps raw product fields to a single display status for Seller Hub.
 * - `inactive` = removed from catalog (soft delete or explicit inactive status)
 * - `photos_uploading` / `photos_retrying` = images copying to S3; not yet in admin queue
 * - `pending` = awaiting admin approval (not the same as removed)
 */
export function getVendorDisplayStatus(
  product: VendorProductStatusFields,
): VendorProductDisplayStatus | string {
  const s = String(product.status ?? '').trim().toLowerCase();

  if (s === 'rejected') return 'rejected';
  if (s === 'draft') return 'draft';
  if (s === 'inactive') return 'inactive';

  // Legacy soft-deletes kept status as "active" but flipped is_active.
  if (product.is_active === false && s === 'active') return 'inactive';

  if (s === 'active' && product.is_active !== false) return 'active';

  if (isPendingLike(s)) {
    return imageHoldKind(product) ?? 'pending';
  }

  if (product.is_active === false) return 'inactive';

  return s;
}

export function isRemovedFromCatalog(product: VendorProductStatusFields): boolean {
  return getVendorDisplayStatus(product) === 'inactive';
}

export function getVendorDisplayStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    pending: 'Pending approval',
    draft: 'Draft',
    rejected: 'Rejected',
    inactive: 'Removed',
    out_of_stock: 'Out of stock',
    photos_uploading: 'Uploading photos',
    photos_retrying: 'Photos retrying',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}
