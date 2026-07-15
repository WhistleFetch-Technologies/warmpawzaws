import type { Hono } from 'hono';
import { customerPhonePreferencesPostHandler } from '../handlers/customer_phone_preferences_post.handler';

export function registerCustomerPhonePreferencesPostRoute(app: Hono) {
  app.post('/customer/:phone/preferences', customerPhonePreferencesPostHandler);
}
