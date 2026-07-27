import type { Context } from 'hono';
import { parseVendorCandidatesQuery } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { catalogueSuccessResponse, mapCatalogueHandlerError } from './catalogue-list.handler';

export async function vendorCandidatesHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parseVendorCandidatesQuery(c.req.query());
    const data = await deps.adminService.searchVendorCandidates(query);
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
