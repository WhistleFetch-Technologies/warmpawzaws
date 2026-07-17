import type { Hono } from 'hono';
import { customerMealplanordersGetHandler } from '../handlers/customer_mealplanorders_get.handler';

export function registerCustomerMealplanordersGetRoute(app: Hono) {
  app.get('/customer/meal-plan-orders', customerMealplanordersGetHandler);
}
