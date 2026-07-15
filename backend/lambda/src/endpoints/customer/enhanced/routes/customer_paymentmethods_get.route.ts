import type { Hono } from 'hono';
import { customerPaymentmethodsGetHandler } from '../handlers/customer_paymentmethods_get.handler';

export function registerCustomerPaymentmethodsGetRoute(app: Hono) {
  app.get('/customer/payment-methods', customerPaymentmethodsGetHandler);
}
