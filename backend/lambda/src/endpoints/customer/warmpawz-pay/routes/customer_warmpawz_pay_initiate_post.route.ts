import type { Hono } from 'hono';
import { customerWarmpawzPayInitiatePostHandler } from '../handlers/customer_warmpawz_pay_initiate_post.handler';

export function registerCustomerWarmpawzPayInitiatePostRoute(app: Hono): void {
  app.post('/customer/warmpawz-pay/initiate', customerWarmpawzPayInitiatePostHandler);
}
