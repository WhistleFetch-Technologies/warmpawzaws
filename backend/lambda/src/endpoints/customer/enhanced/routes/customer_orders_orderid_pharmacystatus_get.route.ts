import type { Hono } from 'hono';
import { customerOrdersOrderidPharmacystatusGetHandler } from '../handlers/customer_orders_orderid_pharmacystatus_get.handler';

export function registerCustomerOrdersOrderidPharmacystatusGetRoute(app: Hono) {
  app.get('/customer/orders/:orderId/pharmacy-status', customerOrdersOrderidPharmacystatusGetHandler);
}
