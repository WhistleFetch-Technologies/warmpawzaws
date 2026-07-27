import type { Context } from 'hono';
import { uuidSchema } from 'src/middleware/validation-middleware';
import { CatalogueErrorCode } from '../dto/catalogue.errors';
import { CatalogueAdminError } from '../services/vendor-catalog-admin.service';
import { getRequiredAdminUserId } from '../middleware/require-admin-permission.middleware';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  mapCatalogueHandlerError,
} from './catalogue-list.handler';

export async function catalogueDeleteHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const catalogueId = uuidSchema.parse(c.req.param('catalogueId'));
    const result = await deps.adminService.deleteEntry(catalogueId, getRequiredAdminUserId(c));
    if (!result) {
      throw new CatalogueAdminError(
        CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND,
        'Catalogue entry not found',
      );
    }
    return catalogueSuccessResponse(c, result);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
