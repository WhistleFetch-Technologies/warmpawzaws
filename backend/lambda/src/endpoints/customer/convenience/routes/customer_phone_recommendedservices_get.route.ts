import type { Hono } from 'hono';
import { customerPhoneRecommendedservicesGetHandler } from '../handlers/customer_phone_recommendedservices_get.handler';

export function registerCustomerPhoneRecommendedservicesGetRoute(app: Hono) {
  app.get("/customer/:phone/recommended-services", customerPhoneRecommendedservicesGetHandler);
}
