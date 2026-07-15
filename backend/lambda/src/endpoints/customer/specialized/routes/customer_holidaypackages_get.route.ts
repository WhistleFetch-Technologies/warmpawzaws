import type { Hono } from 'hono';
import { customerHolidaypackagesGetHandler } from '../handlers/customer_holidaypackages_get.handler';

export function registerCustomerHolidaypackagesGetRoute(app: Hono) {
  app.get("/customer/holiday-packages", customerHolidaypackagesGetHandler);
}
