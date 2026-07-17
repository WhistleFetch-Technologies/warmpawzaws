import type { Hono } from 'hono';
import { getDeliveryFeePolicyHandler } from '../handlers/get-delivery-fee-policy.handler';

export function registerGetDeliveryFeePolicyRoute(app: Hono) {
  app.get('/customer/delivery-fee-policy', getDeliveryFeePolicyHandler);
}
