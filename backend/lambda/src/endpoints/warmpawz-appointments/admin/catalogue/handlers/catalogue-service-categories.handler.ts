import type { Context } from 'hono';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { mapWapptAdminHandlerError, WapptAdminSuccessResponse } from '../../shared/wappt-admin-response.helpers';

export async function catalogueServiceCategoriesHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const data = await deps.adminService.listServiceCategories();
    return WapptAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWapptAdminHandlerError(c, error);
  }
}
