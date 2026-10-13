import type { Hono } from 'hono';
import { customerInsurancePlansGetHandler } from '../handlers/customer_insurance_plans_get.handler';

export function registerCustomerInsurancePlansGetRoute(app: Hono) {
  app.get('/customer/insurance/plans', customerInsurancePlansGetHandler);
}
