import type { Hono } from 'hono';
import { customerPhoneOrdersMealsActiveGetHandler } from '../handlers/customer_phone_orders_meals_active_get.handler';

export function registerCustomerPhoneOrdersMealsActiveGetRoute(app: Hono) {
  app.get('/customer/:phone/orders/meals/active', customerPhoneOrdersMealsActiveGetHandler);
}
