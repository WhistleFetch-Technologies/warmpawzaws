import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsIdConfirmPolicyPost } from '../services/customer_insurance_applications_id_confirm_policy_post.service';

export async function customerInsuranceApplicationsIdConfirmPolicyPostHandler(c: Context) {
  return executecustomerInsuranceApplicationsIdConfirmPolicyPost(c);
}
