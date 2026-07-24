import type { Context } from 'hono';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { mapWpayAdminHandlerError, wpayAdminSuccessResponse } from '../../shared/wpay-admin-response.helpers';

export async function catalogueServiceCategoriesHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const data = await deps.adminService.listServiceCategories();
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
