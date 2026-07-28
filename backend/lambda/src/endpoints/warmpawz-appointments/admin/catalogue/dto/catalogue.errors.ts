/**
 * Warmpawz Pay catalogue admin — application error codes.
 */
export const CatalogueErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VENDOR_NOT_FOUND: 'VENDOR_NOT_FOUND',
  VENDOR_DELETED: 'VENDOR_DELETED',
  CATALOGUE_ENTRY_NOT_FOUND: 'CATALOGUE_ENTRY_NOT_FOUND',
  DUPLICATE_CATALOGUE_ENTRY: 'DUPLICATE_CATALOGUE_ENTRY',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  AUDIT_PERSISTENCE_ERROR: 'AUDIT_PERSISTENCE_ERROR',
} as const;

export type CatalogueErrorCode =
  (typeof CatalogueErrorCode)[keyof typeof CatalogueErrorCode];

export interface CatalogueErrorBody {
  readonly code: CatalogueErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export interface CatalogueErrorResponse {
  readonly success: false;
  readonly error: CatalogueErrorBody;
}
