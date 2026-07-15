import type { Hono } from 'hono';
import { customerCustomeridPreferencesGetHandler } from '../handlers/customer_customerid_preferences_get.handler';

export function registerCustomerCustomeridPreferencesGetRoute(app: Hono) {
  app.get("/customer/:customerId/preferences", customerCustomeridPreferencesGetHandler);
}
