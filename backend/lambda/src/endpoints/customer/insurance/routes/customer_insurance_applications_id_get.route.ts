import type { Hono } from 'hono';
import { customerInsuranceApplicationsIdGetHandler } from '../handlers/customer_insurance_applications_id_get.handler';

export function registerCustomerInsuranceApplicationsIdGetRoute(app: Hono) {
  app.get('/customer/insurance/applications/:id', customerInsuranceApplicationsIdGetHandler);
}
