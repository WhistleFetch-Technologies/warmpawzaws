import type { Context } from 'hono';
import { CatalogueErrorCode } from '../dto/catalogue.errors';
import { parseCatalogueListQuery } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { CatalogueAdminError } from '../services/vendor-catalog-admin.service';
import {
  mapWapptAdminHandlerError,
  WapptAdminSuccessResponse,
} from '../../shared/wappt-admin-response.helpers';

export function invalidJsonBodyError(): CatalogueAdminError {
  return new CatalogueAdminError(CatalogueErrorCode.VALIDATION_ERROR, 'Invalid JSON body');
}

/** @deprecated Prefer WapptAdminSuccessResponse from admin/shared — kept for catalogue handlers. */
export const catalogueSuccessResponse = WapptAdminSuccessResponse;

/** @deprecated Prefer mapWapptAdminHandlerError from admin/shared — kept for catalogue handlers. */
export const mapCatalogueHandlerError = mapWapptAdminHandlerError;

export async function catalogueListHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parseCatalogueListQuery(c.req.query());
    const data = await deps.adminService.listEntries(query);
    return WapptAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWapptAdminHandlerError(c, error);
  }
}
