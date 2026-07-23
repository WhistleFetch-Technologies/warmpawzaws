import type { Context } from 'hono';
import { CatalogueErrorCode } from '../dto/catalogue.errors';
import { parseCatalogueListQuery } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { CatalogueAdminError } from '../services/vendor-catalog-admin.service';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';

export function invalidJsonBodyError(): CatalogueAdminError {
  return new CatalogueAdminError(CatalogueErrorCode.VALIDATION_ERROR, 'Invalid JSON body');
}

/** @deprecated Prefer wpayAdminSuccessResponse from admin/shared — kept for catalogue handlers. */
export const catalogueSuccessResponse = wpayAdminSuccessResponse;

/** @deprecated Prefer mapWpayAdminHandlerError from admin/shared — kept for catalogue handlers. */
export const mapCatalogueHandlerError = mapWpayAdminHandlerError;

export async function catalogueListHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parseCatalogueListQuery(c.req.query());
    const data = await deps.adminService.listEntries(query);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
