import type { Hono } from 'hono';
import { customerInsuranceApplicationsIdFormPostHandler } from '../handlers/customer_insurance_applications_id_form_post.handler';

export function registerCustomerInsuranceApplicationsIdFormPostRoute(app: Hono) {
  app.post('/customer/insurance/applications/:id/form', customerInsuranceApplicationsIdFormPostHandler);
}
