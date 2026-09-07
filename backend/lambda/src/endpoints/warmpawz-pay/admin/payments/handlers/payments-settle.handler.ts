import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parsePaymentsSettleBody } from '../dto/payments.requests';
import type { PaymentsAdminRouteDeps } from '../routes/payments-admin.routes';

export async function paymentsSettleHandler(
  c: Context,
  deps: PaymentsAdminRouteDeps,
): Promise<Response> {
  try {
    const body = parsePaymentsSettleBody(await c.req.json().catch(() => ({})));
    const data = await deps.paymentsService.settlePayments(body);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
