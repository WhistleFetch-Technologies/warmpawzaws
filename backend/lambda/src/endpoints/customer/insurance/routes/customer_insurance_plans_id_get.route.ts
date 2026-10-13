import type { Hono } from 'hono';
import { customerInsurancePlansIdGetHandler } from '../handlers/customer_insurance_plans_id_get.handler';

export function registerCustomerInsurancePlansIdGetRoute(app: Hono) {
  app.get('/customer/insurance/plans/:id', customerInsurancePlansIdGetHandler);
}
