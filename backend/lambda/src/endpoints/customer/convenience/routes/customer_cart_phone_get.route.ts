import type { Hono } from 'hono';
import { customerCartPhoneGetHandler } from '../handlers/customer_cart_phone_get.handler';

export function registerCustomerCartPhoneGetRoute(app: Hono) {
  app.get("/customer/cart/:phone", customerCartPhoneGetHandler);
}
