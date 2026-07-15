import type { Hono } from 'hono';
import { customerSavedPhoneGetHandler } from '../handlers/customer_saved_phone_get.handler';

export function registerCustomerSavedPhoneGetRoute(app: Hono) {
  app.get("/customer/saved/:phone", customerSavedPhoneGetHandler);
}
