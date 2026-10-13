import type { Hono } from 'hono';
import { customerInsuranceApplicationsIdFormGetHandler } from '../handlers/customer_insurance_applications_id_form_get.handler';

export function registerCustomerInsuranceApplicationsIdFormGetRoute(app: Hono) {
  app.get('/customer/insurance/applications/:id/form', customerInsuranceApplicationsIdFormGetHandler);
}
