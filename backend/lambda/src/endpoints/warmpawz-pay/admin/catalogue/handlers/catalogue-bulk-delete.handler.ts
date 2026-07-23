import type { Context } from 'hono';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  mapCatalogueHandlerError,
  readAdminUserId,
} from './catalogue-list.handler';
import {
  parseDedupedBulkCatalogueOperationRequest,
  readBulkCatalogueOperationBody,
} from './catalogue-bulk-publish.handler';

export async function catalogueBulkDeleteHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const catalogueIds = parseDedupedBulkCatalogueOperationRequest(await readBulkCatalogueOperationBody(c));
    const data = await deps.adminService.bulkDelete(catalogueIds, readAdminUserId(c) ?? '');
    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
