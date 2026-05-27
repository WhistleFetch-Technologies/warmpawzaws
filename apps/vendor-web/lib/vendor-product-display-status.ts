/** Vendor catalog badge / filter status derived from API `status` + `is_active`. */
export type VendorProductDisplayStatus =
  | 'active'
  | 'pending'
  | 'draft'
  | 'rejected'
  | 'inactive'
  | 'out_of_stock';

export interface VendorProductStatusFields {
  status?: string | null;
  is_active?: boolean | null;
}

/**
 * Maps raw product fields to a single display status for Seller Hub.
 * - `inactive` = removed from catalog (soft delete or explicit inactive status)
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

  if (
    s === 'pending' ||
    s === 'pending_approval' ||
    s === 'submit_for_approval' ||
    s === 'submitted' ||
    !s
  ) {
    return 'pending';
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
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}
