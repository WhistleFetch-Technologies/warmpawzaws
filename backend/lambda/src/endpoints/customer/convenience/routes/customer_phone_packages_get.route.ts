import type { Hono } from 'hono';
import { customerPhonePackagesGetHandler } from '../handlers/customer_phone_packages_get.handler';

export function registerCustomerPhonePackagesGetRoute(app: Hono) {
  app.get("/customer/:phone/packages", customerPhonePackagesGetHandler);
}
