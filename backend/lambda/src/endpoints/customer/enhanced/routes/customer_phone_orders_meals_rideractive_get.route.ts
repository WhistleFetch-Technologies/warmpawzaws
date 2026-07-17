import type { Hono } from 'hono';
import { customerPhoneOrdersMealsRideractiveGetHandler } from '../handlers/customer_phone_orders_meals_rideractive_get.handler';

export function registerCustomerPhoneOrdersMealsRideractiveGetRoute(app: Hono) {
  app.get('/customer/:phone/orders/meals/rider-active', customerPhoneOrdersMealsRideractiveGetHandler);
}
