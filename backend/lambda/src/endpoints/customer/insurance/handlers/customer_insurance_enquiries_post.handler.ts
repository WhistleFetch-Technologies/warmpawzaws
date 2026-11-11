import type { Context } from 'hono';
import { executecustomerInsuranceEnquiriesPost } from '../services/customer_insurance_enquiries_post.service';

export async function customerInsuranceEnquiriesPostHandler(c: Context) {
  return executecustomerInsuranceEnquiriesPost(c);
}
