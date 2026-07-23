export const PricingErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VENDOR_NOT_FOUND: 'VENDOR_NOT_FOUND',
  VENDOR_NOT_IN_CATALOGUE: 'VENDOR_NOT_IN_CATALOGUE',
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
  DUPLICATE_PRICING: 'DUPLICATE_PRICING',
  ACTIVE_PRICING_CONFLICT: 'ACTIVE_PRICING_CONFLICT',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  AUDIT_PERSISTENCE_ERROR: 'AUDIT_PERSISTENCE_ERROR',
} as const;

export type PricingErrorCode = (typeof PricingErrorCode)[keyof typeof PricingErrorCode];

export interface PricingErrorBody {
  readonly code: PricingErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export interface PricingErrorResponse {
  readonly success: false;
  readonly error: PricingErrorBody;
}

export interface PricingSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}
