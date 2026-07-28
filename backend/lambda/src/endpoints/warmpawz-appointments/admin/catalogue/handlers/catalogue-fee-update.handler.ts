import type { Context } from 'hono';
import { uuidSchema } from 'src/middleware/validation-middleware';
import { CatalogueErrorCode } from '../dto/catalogue.errors';
import { parseUpdateCatalogueFeeRequest } from '../dto/catalogue.requests';
import { CatalogueAdminError } from '../services/vendor-catalog-admin.service';
import { getRequiredAdminUserId } from '../middleware/require-admin-permission.middleware';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  invalidJsonBodyError,
  mapCatalogueHandlerError,
} from './catalogue-list.handler';

export async function catalogueFeeUpdateHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const catalogueId = uuidSchema.parse(c.req.param('catalogueId'));
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapCatalogueHandlerError(c, invalidJsonBodyError());
    }

    const input = parseUpdateCatalogueFeeRequest(body);
    const data = await deps.adminService.updateFee(
      catalogueId,
      input,
      getRequiredAdminUserId(c),
    );

    if (!data) {
      return mapCatalogueHandlerError(
        c,
        new CatalogueAdminError(
          CatalogueErrorCode.CATALOGUE_ENTRY_NOT_FOUND,
          'Catalogue entry not found',
        ),
      );
    }

    return catalogueSuccessResponse(c, data);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
