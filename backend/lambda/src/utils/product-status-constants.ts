/**
 * Canonical product status values.
 * Use these constants instead of inline string literals to avoid typos
 * and to make status comparisons grep-able across the codebase.
 */
export const PRODUCT_STATUS = {
  /** Visible on the customer storefront. */
  ACTIVE: 'active',
  /** Submitted by vendor; awaiting admin approval. */
  PENDING: 'pending',
  /**
   * Auto-assigned when total stock across all SKUs is 0.
   * Draft products are never shown on the customer storefront.
   * When stock is restocked to > 0, status reverts to 'pending' for admin approval.
   */
  DRAFT: 'draft',
  /** Manually deactivated by admin or vendor. */
  INACTIVE: 'inactive',
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];
