import type { Hono } from 'hono';
import { putAdminDeliveryFeePolicyHandler } from '../handlers/put-admin-delivery-fee-policy.handler';

export function registerPutAdminDeliveryFeePolicyRoute(app: Hono) {
  app.put('/admin/delivery-fee-policy', putAdminDeliveryFeePolicyHandler);
}
