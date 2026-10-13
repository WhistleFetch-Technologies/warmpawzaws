import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsIdFormPost } from '../services/customer_insurance_applications_id_form_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerInsuranceApplicationsIdFormPostHandler(c: Context) {
  return executecustomerInsuranceApplicationsIdFormPost(c);
}
