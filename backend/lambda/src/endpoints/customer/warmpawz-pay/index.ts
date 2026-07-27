import type { Hono } from 'hono';
import { registerCustomerWarmpawzPayVendorsGetRoute } from './routes/customer_warmpawz_pay_vendors_get.route';
import { registerCustomerWarmpawzPayVendorGetRoute } from './routes/customer_warmpawz_pay_vendor_get.route';
import { registerCustomerWarmpawzPayInitiatePostRoute } from './routes/customer_warmpawz_pay_initiate_post.route';
import { registerCustomerWarmpawzPayVerifyPostRoute } from './routes/customer_warmpawz_pay_verify_post.route';
import { registerCustomerWarmpawzPayTransactionsGetRoute } from './routes/customer_warmpawz_pay_transactions_get.route';

export function registerCustomerWarmpawzPayEndpoints(app: Hono) {
  registerCustomerWarmpawzPayVendorsGetRoute(app);
  registerCustomerWarmpawzPayVendorGetRoute(app);
  registerCustomerWarmpawzPayInitiatePostRoute(app);
  registerCustomerWarmpawzPayVerifyPostRoute(app);
  registerCustomerWarmpawzPayTransactionsGetRoute(app);
}
