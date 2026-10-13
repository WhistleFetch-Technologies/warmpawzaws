import type { Hono } from 'hono';
import { registerCustomerInsurancePlansGetRoute } from './routes/customer_insurance_plans_get.route';
import { registerCustomerInsurancePlansIdGetRoute } from './routes/customer_insurance_plans_id_get.route';
import { registerCustomerInsuranceApplicationsPostRoute } from './routes/customer_insurance_applications_post.route';
import { registerCustomerInsuranceApplicationsIdFormGetRoute } from './routes/customer_insurance_applications_id_form_get.route';
import { registerCustomerInsuranceApplicationsIdFormPostRoute } from './routes/customer_insurance_applications_id_form_post.route';
import { registerCustomerInsuranceApplicationsIdPaymentReportedPostRoute } from './routes/customer_insurance_applications_id_payment_reported_post.route';
import { registerCustomerInsuranceApplicationsIdConfirmPolicyPostRoute } from './routes/customer_insurance_applications_id_confirm_policy_post.route';
import { registerCustomerInsurancePoliciesGetRoute } from './routes/customer_insurance_policies_get.route';

export function registerCustomerInsuranceEndpoints(app: Hono) {
  registerCustomerInsurancePlansGetRoute(app);
  registerCustomerInsurancePlansIdGetRoute(app);
  registerCustomerInsurancePoliciesGetRoute(app);
  registerCustomerInsuranceApplicationsPostRoute(app);
  registerCustomerInsuranceApplicationsIdFormGetRoute(app);
  registerCustomerInsuranceApplicationsIdFormPostRoute(app);
  registerCustomerInsuranceApplicationsIdPaymentReportedPostRoute(app);
  registerCustomerInsuranceApplicationsIdConfirmPolicyPostRoute(app);
}
