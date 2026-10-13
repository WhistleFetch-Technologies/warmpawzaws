import type { Hono } from 'hono';
import { registerCustomerInsurancePlansGetRoute } from './routes/customer_insurance_plans_get.route';
import { registerCustomerInsurancePlansIdGetRoute } from './routes/customer_insurance_plans_id_get.route';
import { registerCustomerInsuranceApplicationsPostRoute } from './routes/customer_insurance_applications_post.route';
import { registerCustomerInsuranceApplicationsIdFormGetRoute } from './routes/customer_insurance_applications_id_form_get.route';
import { registerCustomerInsuranceApplicationsIdFormPostRoute } from './routes/customer_insurance_applications_id_form_post.route';

export function registerCustomerInsuranceEndpoints(app: Hono) {
  registerCustomerInsurancePlansGetRoute(app);
  registerCustomerInsurancePlansIdGetRoute(app);
  registerCustomerInsuranceApplicationsPostRoute(app);
  registerCustomerInsuranceApplicationsIdFormGetRoute(app);
  registerCustomerInsuranceApplicationsIdFormPostRoute(app);
}
