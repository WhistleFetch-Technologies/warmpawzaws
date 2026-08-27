import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parseUpdateConvenienceSettingsRequest } from '../dto/convenience.requests';
import type { ConvenienceSettingsRouteDeps } from '../routes/convenience-settings.routes';
import { WARMPAWZ_PAY_CONVENIENCE_LOG_PREFIX } from '../services/wpay-convenience-settings.service';
import { invalidJsonBodyError } from '../../pricing/handlers/pricing-detail.handler';

export async function convenienceSettingsPutHandler(
  c: Context,
  deps: ConvenienceSettingsRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_CONVENIENCE_LOG_PREFIX} PUT /admin/warmpawz-pay/settings/convenience`);

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapWpayAdminHandlerError(c, invalidJsonBodyError());
    }

    const input = parseUpdateConvenienceSettingsRequest(body);
    const data = await deps.convenienceSettingsService.putConvenienceSettings(input);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
