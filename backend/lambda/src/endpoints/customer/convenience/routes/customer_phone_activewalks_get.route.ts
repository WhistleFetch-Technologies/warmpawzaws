import type { Hono } from 'hono';
import { customerPhoneActivewalksGetHandler } from '../handlers/customer_phone_activewalks_get.handler';

export function registerCustomerPhoneActivewalksGetRoute(app: Hono) {
  app.get("/customer/:phone/active-walks", customerPhoneActivewalksGetHandler);
}
