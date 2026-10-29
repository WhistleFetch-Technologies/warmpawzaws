import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import type { VendorExportSettingsRouteDeps } from '../routes/vendor-export-settings.routes';
import { WARMPAWZ_PAY_VENDOR_EXPORT_LOG_PREFIX } from '../services/wpay-vendor-export-settings.service';

export async function vendorExportSettingsGetHandler(
  c: Context,
  deps: VendorExportSettingsRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_VENDOR_EXPORT_LOG_PREFIX} GET /admin/warmpawz-pay/settings/vendor-export`);

  try {
    const data = await deps.vendorExportSettingsService.getVendorExportSettings();
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
