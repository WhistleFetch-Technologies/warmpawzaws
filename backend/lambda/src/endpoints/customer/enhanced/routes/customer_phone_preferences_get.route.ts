import type { Hono } from 'hono';
import { customerPhonePreferencesGetHandler } from '../handlers/customer_phone_preferences_get.handler';

export function registerCustomerPhonePreferencesGetRoute(app: Hono) {
  app.get('/customer/:phone/preferences', customerPhonePreferencesGetHandler);
}
