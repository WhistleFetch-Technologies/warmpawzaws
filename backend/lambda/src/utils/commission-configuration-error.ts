/**
 * Thrown when ecommerce commission cannot be resolved from configured sources.
 * No silent fallbacks — payment/checkout must fail closed.
 */

export type CommissionSource =
  | 'vendor_category'
  | 'vendor_own_brand'
  | 'vendor_third_party'
  | 'vendor_default'
  | 'category_default';

export class CommissionConfigurationError extends Error {
  readonly code = 'COMMISSION_NOT_CONFIGURED' as const;
  readonly vendorId: string;
  readonly productId?: string;
  readonly categoryId?: string;
  readonly missing: string[];

  constructor(params: {
    message?: string;
    vendorId: string;
    productId?: string;
    categoryId?: string;
    missing: string[];
  }) {
    const missingList = params.missing.join(', ');
    super(
      params.message ??
        `Commission not configured for vendor ${params.vendorId}${params.productId ? ` product ${params.productId}` : ''}: missing ${missingList}`
    );
    this.name = 'CommissionConfigurationError';
    this.vendorId = params.vendorId;
    this.productId = params.productId;
    this.categoryId = params.categoryId;
    this.missing = params.missing;
  }
}

export function isCommissionConfigurationError(
  err: unknown
): err is CommissionConfigurationError {
  return (
    err instanceof CommissionConfigurationError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'COMMISSION_NOT_CONFIGURED')
  );
}
