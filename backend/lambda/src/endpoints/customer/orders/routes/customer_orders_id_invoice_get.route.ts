import type { Hono } from 'hono';
import { customerOrdersIdInvoiceGetHandler } from '../handlers/customer_orders_id_invoice_get.handler';

export function registerCustomerOrdersIdInvoiceGetRoute(app: Hono) {
  app.get('/customer/orders/:id/invoice', customerOrdersIdInvoiceGetHandler);
}
