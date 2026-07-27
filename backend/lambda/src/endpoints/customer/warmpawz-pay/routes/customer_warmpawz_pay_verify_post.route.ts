import type { Hono } from 'hono';
import { customerWarmpawzPayVerifyPostHandler } from '../handlers/customer_warmpawz_pay_verify_post.handler';

export function registerCustomerWarmpawzPayVerifyPostRoute(app: Hono): void {
  app.post('/customer/warmpawz-pay/verify', customerWarmpawzPayVerifyPostHandler);
}
