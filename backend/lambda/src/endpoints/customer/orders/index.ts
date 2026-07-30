import type { Hono } from 'hono';
import { registerCustomerOrdersPostRoute } from './routes/customer_orders_post.route';
import { registerCustomerOrdersGetRoute } from './routes/customer_orders_get.route';
import { registerCustomerOrdersIdPaymentresumeGetRoute } from './routes/customer_orders_id_paymentresume_get.route';
import { registerCustomerOrdersIdGetRoute } from './routes/customer_orders_id_get.route';
import { registerCustomerOrdersIdInvoiceGetRoute } from './routes/customer_orders_id_invoice_get.route';
import { registerCustomerOrdersIdReturnPostRoute } from './routes/customer_orders_id_return_post.route';
import { registerCustomerOrdersIdCancelDraftPostRoute } from './routes/customer_orders_id_cancel_draft_post.route';
import { registerCustomerOrdersIdReconcilepaymentPostRoute } from './routes/customer_orders_id_reconcilepayment_post.route';

export function registerCustomerOrdersEndpoints(app: Hono) {
  registerCustomerOrdersPostRoute(app);
  registerCustomerOrdersGetRoute(app);
  registerCustomerOrdersIdPaymentresumeGetRoute(app);
  registerCustomerOrdersIdGetRoute(app);
  registerCustomerOrdersIdInvoiceGetRoute(app);
  registerCustomerOrdersIdReturnPostRoute(app);
  registerCustomerOrdersIdCancelDraftPostRoute(app);
  registerCustomerOrdersIdReconcilepaymentPostRoute(app);
}
