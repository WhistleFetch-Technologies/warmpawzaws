import type { Hono } from 'hono';
import { getAdminDeliveryFeePolicyHandler } from '../handlers/get-admin-delivery-fee-policy.handler';

export function registerGetAdminDeliveryFeePolicyRoute(app: Hono) {
  app.get('/admin/delivery-fee-policy', getAdminDeliveryFeePolicyHandler);
}
