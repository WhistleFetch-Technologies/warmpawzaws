import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsPost } from '../services/customer_insurance_applications_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerInsuranceApplicationsPostHandler(c: Context) {
  return executecustomerInsuranceApplicationsPost(c);
}
