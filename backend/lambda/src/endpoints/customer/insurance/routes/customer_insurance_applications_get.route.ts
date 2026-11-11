import type { Hono } from 'hono';
import { customerInsuranceApplicationsGetHandler } from '../handlers/customer_insurance_applications_get.handler';

export function registerCustomerInsuranceApplicationsGetRoute(app: Hono) {
  app.get('/customer/insurance/applications', customerInsuranceApplicationsGetHandler);
}
