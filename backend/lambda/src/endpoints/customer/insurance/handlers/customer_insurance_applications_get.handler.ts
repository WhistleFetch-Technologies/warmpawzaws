import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsGet } from '../services/customer_insurance_applications_get.service';

export async function customerInsuranceApplicationsGetHandler(c: Context) {
  return executecustomerInsuranceApplicationsGet(c);
}
