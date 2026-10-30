import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { CatalogueAdminError } from '../../catalogue/services/vendor-catalog-admin.service';
import { CatalogueErrorCode } from '../../catalogue/dto/catalogue.errors';
import { ADMIN_USER_ID_CONTEXT_KEY } from '../../catalogue/authorization/permission-types';
import type { PaymentsAdminRouteDeps } from '../routes/payments-admin.routes';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function paymentsBillVerifyHandler(
  c: Context,
  deps: PaymentsAdminRouteDeps,
): Promise<Response> {
  try {
    const paymentId = String(c.req.param('paymentId') || '').trim();
    if (!UUID_RE.test(paymentId)) {
      throw new CatalogueAdminError(CatalogueErrorCode.VALIDATION_ERROR, 'paymentId must be a UUID');
    }
    const verifiedBy = String(c.get(ADMIN_USER_ID_CONTEXT_KEY) || c.get('userId') || '').trim();
    if (!verifiedBy) {
      throw new CatalogueAdminError(CatalogueErrorCode.UNAUTHORIZED, 'Authentication required');
    }
    const data = await deps.paymentsService.verifyPaymentBill(paymentId, verifiedBy);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
