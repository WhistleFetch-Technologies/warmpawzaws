import type { Context } from 'hono';
import { ZodError } from 'zod';
import { parseBulkCatalogueRequest } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  mapCatalogueHandlerError,
  readAdminUserId,
} from './catalogue-list.handler';

export function parseDedupedBulkCatalogueOperationRequest(body: unknown): readonly string[] {
  const { catalogueIds } = parseBulkCatalogueRequest(body);
  return [...new Set(catalogueIds)];
}

async function readBulkCatalogueOperationBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ZodError([]);
  }
}

export { readBulkCatalogueOperationBody };

export async function catalogueBulkPublishHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const catalogueIds = parseDedupedBulkCatalogueOperationRequest(await readBulkCatalogueOperationBody(c));
    const data = await deps.adminService.bulkPublish(catalogueIds, readAdminUserId(c) ?? '');
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
