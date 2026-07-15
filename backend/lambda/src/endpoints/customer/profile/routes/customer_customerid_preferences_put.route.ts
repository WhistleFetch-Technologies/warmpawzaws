import type { Hono } from 'hono';
import { customerCustomeridPreferencesPutHandler } from '../handlers/customer_customerid_preferences_put.handler';

export function registerCustomerCustomeridPreferencesPutRoute(app: Hono) {
  app.put("/customer/:customerId/preferences", customerCustomeridPreferencesPutHandler);
}
