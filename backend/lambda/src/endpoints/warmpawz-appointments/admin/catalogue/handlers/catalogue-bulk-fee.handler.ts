import type { Context } from 'hono';
import { parseBulkCatalogueFeeRequest } from '../dto/catalogue.requests';
import { getRequiredAdminUserId } from '../middleware/require-admin-permission.middleware';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  invalidJsonBodyError,
  mapCatalogueHandlerError,
} from './catalogue-list.handler';

export async function catalogueBulkFeeHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapCatalogueHandlerError(c, invalidJsonBodyError());
    }

    const input = parseBulkCatalogueFeeRequest(body);
    const data = await deps.adminService.bulkUpdateFee(input, getRequiredAdminUserId(c));
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
