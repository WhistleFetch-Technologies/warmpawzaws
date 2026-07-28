import type { Context } from 'hono';
import { parseCreateCatalogueRequest } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { getRequiredAdminUserId } from '../middleware/require-admin-permission.middleware';
import {
  catalogueSuccessResponse,
  invalidJsonBodyError,
  mapCatalogueHandlerError,
} from './catalogue-list.handler';

export async function catalogueCreateHandler(
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
    const input = parseCreateCatalogueRequest(body);
    const data = await deps.adminService.createEntry(input, getRequiredAdminUserId(c));
    return catalogueSuccessResponse(c, data, 201);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
