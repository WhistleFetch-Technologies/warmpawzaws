import type { Context } from 'hono';
import { CatalogueErrorCode } from '../../catalogue/dto/catalogue.errors';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parseMerchantListQuery } from '../dto/merchants.requests';
import type { MerchantsAdminRouteDeps } from '../routes/merchants-admin.routes';
import {
  MerchantListLoadError,
  WARMPAWZ_PAY_MERCHANTS_LOG_PREFIX,
} from '../services/warmpawz-pay-merchants.service';

export async function merchantsListHandler(
  c: Context,
  deps: MerchantsAdminRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_MERCHANTS_LOG_PREFIX} GET /admin/warmpawz-pay/merchants`);

  try {
    const query = parseMerchantListQuery(c.req.query());
    const data = await deps.merchantsService.listMerchants(query);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    if (error instanceof MerchantListLoadError) {
      console.error(
        `${WARMPAWZ_PAY_MERCHANTS_LOG_PREFIX} Repository failure`,
        error.cause ?? error,
      );
      return mapWpayAdminHandlerError(c, error);
    }

    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'ZodError'
    ) {
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

    console.error(`${WARMPAWZ_PAY_MERCHANTS_LOG_PREFIX} Unexpected error`, error);
    return mapWpayAdminHandlerError(c, error);
  }
}
