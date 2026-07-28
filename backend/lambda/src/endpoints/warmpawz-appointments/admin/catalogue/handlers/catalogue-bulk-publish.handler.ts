import type { Context } from 'hono';
import { parseBulkCatalogueRequest } from '../dto/catalogue.requests';
import { getRequiredAdminUserId } from '../middleware/require-admin-permission.middleware';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  invalidJsonBodyError,
  mapCatalogueHandlerError,
} from './catalogue-list.handler';

export function parseDedupedBulkCatalogueOperationRequest(body: unknown): readonly string[] {
  const { catalogueIds } = parseBulkCatalogueRequest(body);
  return [...new Set(catalogueIds)];
}

async function readBulkCatalogueOperationBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw invalidJsonBodyError();
  }
}

export { readBulkCatalogueOperationBody };

export async function catalogueBulkPublishHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const catalogueIds = parseDedupedBulkCatalogueOperationRequest(await readBulkCatalogueOperationBody(c));
    const data = await deps.adminService.bulkPublish(catalogueIds, getRequiredAdminUserId(c));
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
