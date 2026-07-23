import type { Context } from 'hono';
import { ZodError } from 'zod';
import {
  CatalogueErrorCode,
  type CatalogueErrorResponse,
} from '../dto/catalogue.errors';
import { parseCatalogueListQuery } from '../dto/catalogue.requests';
import type { SuccessResponse } from '../dto/catalogue.responses';
import { CatalogueAdminError } from '../services/vendor-catalog-admin.service';
import { CatalogueRepositoryError } from '../../../repositories/vendor-catalog.repository';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';

const CATALOGUE_ERROR_HTTP_STATUS: Readonly<Record<CatalogueErrorCode, number>> = {
  [CatalogueErrorCode.VALIDATION_ERROR]: 400,
  [CatalogueErrorCode.UNAUTHORIZED]: 401,
  [CatalogueErrorCode.FORBIDDEN]: 403,
  [CatalogueErrorCode.VENDOR_NOT_FOUND]: 404,
  [CatalogueErrorCode.VENDOR_DELETED]: 404,
  [CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND]: 404,
  [CatalogueErrorCode.DUPLICATE_CATALOGUE_ENTRY]: 409,
  [CatalogueErrorCode.FEATURE_DISABLED]: 503,
};

export function catalogueSuccessResponse<T>(
  c: Context,
  data: T,
  status: 200 | 201 = 200,
): Response {
  const body: SuccessResponse<T> = { success: true, data };
  return c.json(body, status);
}

export function mapCatalogueHandlerError(c: Context, error: unknown): Response {
  if (error instanceof ZodError) {
    const body: CatalogueErrorResponse = {
      success: false,
      error: {
        code: CatalogueErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.flatten(),
      },
    };
    return c.json(body, 400);
  }

  if (error instanceof CatalogueAdminError || error instanceof CatalogueRepositoryError) {
    const status = CATALOGUE_ERROR_HTTP_STATUS[error.code] ?? 500;
    const body: CatalogueErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
    return c.json(body, status as 400 | 401 | 403 | 404 | 409 | 503 | 500);
  }

  const body: CatalogueErrorResponse = {
    success: false,
    error: {
      code: CatalogueErrorCode.VALIDATION_ERROR,
      message: 'Internal server error',
    },
  };
  return c.json(body, 500 as const);
}

export async function catalogueListHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parseCatalogueListQuery(c.req.query());
    const data = await deps.adminService.listEntries(query);
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
