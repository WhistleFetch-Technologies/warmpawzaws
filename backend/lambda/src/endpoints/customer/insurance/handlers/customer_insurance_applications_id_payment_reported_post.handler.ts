import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsIdPaymentReportedPost } from '../services/customer_insurance_applications_id_payment_reported_post.service';

export async function customerInsuranceApplicationsIdPaymentReportedPostHandler(c: Context) {
  return executecustomerInsuranceApplicationsIdPaymentReportedPost(c);
}
