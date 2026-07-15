import type { Hono } from 'hono';
import { customerOrdersIdPaymentresumeGetHandler } from '../handlers/customer_orders_id_paymentresume_get.handler';

export function registerCustomerOrdersIdPaymentresumeGetRoute(app: Hono) {
  app.get('/customer/orders/:id/payment-resume', customerOrdersIdPaymentresumeGetHandler);
}
