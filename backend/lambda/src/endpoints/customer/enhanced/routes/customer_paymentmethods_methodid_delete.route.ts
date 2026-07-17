import type { Hono } from 'hono';
import { customerPaymentmethodsMethodidDeleteHandler } from '../handlers/customer_paymentmethods_methodid_delete.handler';

export function registerCustomerPaymentmethodsMethodidDeleteRoute(app: Hono) {
  app.delete('/customer/payment-methods/:methodId', customerPaymentmethodsMethodidDeleteHandler);
}
