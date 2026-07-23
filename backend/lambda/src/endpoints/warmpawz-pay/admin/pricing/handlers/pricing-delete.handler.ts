import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { getRequiredAdminUserId } from '../middleware/require-pricing-admin-permission.middleware';
import type { PricingAdminRouteDeps } from '../routes/pricing-admin.routes';
import { WARMPAWZ_PAY_PRICING_LOG_PREFIX } from '../services/warmpawz-pay-pricing.service';

export async function pricingDeleteHandler(
  c: Context,
  deps: PricingAdminRouteDeps,
): Promise<Response> {
  const merchantId = c.req.param('merchantId');
  console.info(
    `${WARMPAWZ_PAY_PRICING_LOG_PREFIX} DELETE /admin/warmpawz-pay/pricing/${merchantId}`,
  );

  try {
    const data = await deps.pricingService.disablePricing(
      merchantId,
      getRequiredAdminUserId(c),
    );
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
