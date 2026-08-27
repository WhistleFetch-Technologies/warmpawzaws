import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import type { ConvenienceSettingsRouteDeps } from '../routes/convenience-settings.routes';
import { WARMPAWZ_PAY_CONVENIENCE_LOG_PREFIX } from '../services/wpay-convenience-settings.service';

export async function convenienceSettingsGetHandler(
  c: Context,
  deps: ConvenienceSettingsRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_CONVENIENCE_LOG_PREFIX} GET /admin/warmpawz-pay/settings/convenience`);

  try {
    const data = await deps.convenienceSettingsService.getConvenienceSettings();
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
