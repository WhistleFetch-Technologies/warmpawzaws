import type { Context } from 'hono';
import { reconcilePendingWpayPayments } from '../../../../customer/warmpawz-pay/shared/reconcile-wpay-razorpay-capture';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import { parsePaymentsListQuery } from '../dto/payments.requests';
import type { PaymentsAdminRouteDeps } from '../routes/payments-admin.routes';

export async function paymentsListHandler(
  c: Context,
  deps: PaymentsAdminRouteDeps,
): Promise<Response> {
  try {
    await reconcilePendingWpayPayments({ limit: 10, minAgeSeconds: 45 }).catch((error) => {
      console.warn('[admin/warmpawz-pay/payments] reconcile failed', error);
    });
    const query = parsePaymentsListQuery(c.req.query());
    const data = await deps.paymentsService.listPayments(query);
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    return mapWpayAdminHandlerError(c, error);
  }
}
