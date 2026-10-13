import type { Hono } from 'hono';
import { customerInsuranceApplicationsIdConfirmPolicyPostHandler } from '../handlers/customer_insurance_applications_id_confirm_policy_post.handler';

export function registerCustomerInsuranceApplicationsIdConfirmPolicyPostRoute(app: Hono) {
  app.post('/customer/insurance/applications/:id/confirm-policy', customerInsuranceApplicationsIdConfirmPolicyPostHandler);
}
