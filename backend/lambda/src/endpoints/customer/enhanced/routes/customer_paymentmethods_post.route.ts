import type { Hono } from 'hono';
import { customerPaymentmethodsPostHandler } from '../handlers/customer_paymentmethods_post.handler';

export function registerCustomerPaymentmethodsPostRoute(app: Hono) {
  app.post('/customer/payment-methods', customerPaymentmethodsPostHandler);
}
