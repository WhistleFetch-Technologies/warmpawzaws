import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { PricingErrorCode } from '../dto/pricing.errors';
import type { PricingAdminRouteDeps } from '../routes/pricing-admin.routes';
import {
  PricingAdminError,
  WARMPAWZ_PAY_PRICING_LOG_PREFIX,
} from '../services/warmpawz-pay-pricing.service';

export async function pricingDetailHandler(
  c: Context,
  deps: PricingAdminRouteDeps,
): Promise<Response> {
  const merchantId = c.req.param('merchantId');
  console.info(
    `${WARMPAWZ_PAY_PRICING_LOG_PREFIX} GET /admin/warmpawz-pay/pricing/${merchantId}`,
  );

  try {
    const data = await deps.pricingService.getPricingByMerchantId(merchantId);
    if (!data) {
      return c.json(
        {
          success: false,
          error: {
            code: PricingErrorCode.PRICING_NOT_FOUND,
            message: 'Pricing configuration not found for this merchant',
          },
        },
        404,
      );
    }
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    console.error(`${WARMPAWZ_PAY_PRICING_LOG_PREFIX} Unexpected error`, error);
    return mapWpayAdminHandlerError(c, error);
  }
}

export function invalidJsonBodyError(): PricingAdminError {
  return new PricingAdminError(PricingErrorCode.VALIDATION_ERROR, 'Invalid JSON body');
}
