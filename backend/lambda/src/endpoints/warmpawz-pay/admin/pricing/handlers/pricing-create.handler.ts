import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parseCreatePricingRequest } from '../dto/pricing.requests';
import { getRequiredAdminUserId } from '../middleware/require-pricing-admin-permission.middleware';
import type { PricingAdminRouteDeps } from '../routes/pricing-admin.routes';
import {
  invalidJsonBodyError,
} from './pricing-detail.handler';
import {
  WARMPAWZ_PAY_PRICING_LOG_PREFIX,
} from '../services/warmpawz-pay-pricing.service';

export async function pricingCreateHandler(
  c: Context,
  deps: PricingAdminRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_PRICING_LOG_PREFIX} POST /admin/warmpawz-pay/pricing`);

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapWpayAdminHandlerError(c, invalidJsonBodyError());
    }

    const input = parseCreatePricingRequest(body);
    const data = await deps.pricingService.createPricing(input, getRequiredAdminUserId(c));
    return wpayAdminSuccessResponse(c, data, 201);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
