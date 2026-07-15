import type { Hono } from 'hono';
import { registerGetDeliveryFeePolicyRoute } from './routes/get-delivery-fee-policy.route';
import { registerCalculateDeliveryFeeRoute } from './routes/calculate-delivery-fee.route';
import { registerGetAdminDeliveryFeePolicyRoute } from './routes/get-admin-delivery-fee-policy.route';
import { registerPutAdminDeliveryFeePolicyRoute } from './routes/put-admin-delivery-fee-policy.route';

export function registerCustomerDeliveryFeePolicyEndpoints(app: Hono) {
  registerGetDeliveryFeePolicyRoute(app);
  registerCalculateDeliveryFeeRoute(app);
  registerGetAdminDeliveryFeePolicyRoute(app);
  registerPutAdminDeliveryFeePolicyRoute(app);
}
