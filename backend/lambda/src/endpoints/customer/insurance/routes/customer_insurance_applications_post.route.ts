import type { Hono } from 'hono';
import { customerInsuranceApplicationsPostHandler } from '../handlers/customer_insurance_applications_post.handler';

export function registerCustomerInsuranceApplicationsPostRoute(app: Hono) {
  app.post('/customer/insurance/applications', customerInsuranceApplicationsPostHandler);
}
