import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parseUpdatePricingRequest } from '../dto/pricing.requests';
import { getRequiredAdminUserId } from '../middleware/require-pricing-admin-permission.middleware';
import type { PricingAdminRouteDeps } from '../routes/pricing-admin.routes';
import { invalidJsonBodyError } from './pricing-detail.handler';
import { WARMPAWZ_PAY_PRICING_LOG_PREFIX } from '../services/warmpawz-pay-pricing.service';

export async function pricingUpdateHandler(
  c: Context,
  deps: PricingAdminRouteDeps,
): Promise<Response> {
  const merchantId = c.req.param('merchantId');
  console.info(
    `${WARMPAWZ_PAY_PRICING_LOG_PREFIX} PUT /admin/warmpawz-pay/pricing/${merchantId}`,
  );

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapWpayAdminHandlerError(c, invalidJsonBodyError());
    }

    const input = parseUpdatePricingRequest(body);
    const data = await deps.pricingService.updatePricing(
      merchantId,
      input,
      getRequiredAdminUserId(c),
    );
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
