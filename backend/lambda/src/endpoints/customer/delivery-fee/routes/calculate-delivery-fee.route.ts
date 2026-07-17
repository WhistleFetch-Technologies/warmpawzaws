import type { Hono } from 'hono';
import { calculateDeliveryFeeHandler } from '../handlers/calculate-delivery-fee.handler';

export function registerCalculateDeliveryFeeRoute(app: Hono) {
  app.post('/customer/delivery-fee/calculate', calculateDeliveryFeeHandler);
}
