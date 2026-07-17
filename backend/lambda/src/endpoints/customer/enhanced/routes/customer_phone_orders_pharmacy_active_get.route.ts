import type { Hono } from 'hono';
import { customerPhoneOrdersPharmacyActiveGetHandler } from '../handlers/customer_phone_orders_pharmacy_active_get.handler';

export function registerCustomerPhoneOrdersPharmacyActiveGetRoute(app: Hono) {
  app.get('/customer/:phone/orders/pharmacy/active', customerPhoneOrdersPharmacyActiveGetHandler);
}
