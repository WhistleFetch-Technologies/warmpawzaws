import type { Hono } from 'hono';
import { customerInsurancePoliciesGetHandler } from '../handlers/customer_insurance_policies_get.handler';

export function registerCustomerInsurancePoliciesGetRoute(app: Hono) {
  app.get('/customer/insurance/policies', customerInsurancePoliciesGetHandler);
}
