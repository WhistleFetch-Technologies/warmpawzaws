import type { Context } from 'hono';
import { ZodError } from 'zod';
import { CatalogueErrorCode } from '../../catalogue/dto/catalogue.errors';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parsePricingListQuery } from '../dto/pricing.requests';
import type { PricingAdminRouteDeps } from '../routes/pricing-admin.routes';
import {
  PricingListLoadError,
  WARMPAWZ_PAY_PRICING_LOG_PREFIX,
} from '../services/warmpawz-pay-pricing.service';

export async function pricingListHandler(
  c: Context,
  deps: PricingAdminRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_PRICING_LOG_PREFIX} GET /admin/warmpawz-pay/pricing`);

  try {
    const query = parsePricingListQuery(c.req.query());
    const data = await deps.pricingService.listPricing(query);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    if (error instanceof PricingListLoadError) {
      console.error(
        `${WARMPAWZ_PAY_PRICING_LOG_PREFIX} Repository failure`,
        error.cause ?? error,
      );
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: CatalogueErrorCode.VALIDATION_ERROR,
            message: 'Invalid query parameters',
          },
        },
        400,
      );
    }

    console.error(`${WARMPAWZ_PAY_PRICING_LOG_PREFIX} Unexpected error`, error);
    return mapWpayAdminHandlerError(c, error);
  }
}
