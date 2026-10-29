import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { invalidJsonBodyError } from '../../pricing/handlers/pricing-detail.handler';
import { parseUpdateVendorExportSettingsRequest } from '../dto/vendor-export.requests';
import type { VendorExportSettingsRouteDeps } from '../routes/vendor-export-settings.routes';
import { WARMPAWZ_PAY_VENDOR_EXPORT_LOG_PREFIX } from '../services/wpay-vendor-export-settings.service';

export async function vendorExportSettingsPutHandler(
  c: Context,
  deps: VendorExportSettingsRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_VENDOR_EXPORT_LOG_PREFIX} PUT /admin/warmpawz-pay/settings/vendor-export`);

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapWpayAdminHandlerError(c, invalidJsonBodyError());
    }

    const input = parseUpdateVendorExportSettingsRequest(body);
    const data = await deps.vendorExportSettingsService.putVendorExportSettings(input);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
