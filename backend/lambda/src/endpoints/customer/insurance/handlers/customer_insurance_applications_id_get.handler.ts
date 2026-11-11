import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsIdGet } from '../services/customer_insurance_applications_id_get.service';

export async function customerInsuranceApplicationsIdGetHandler(c: Context) {
  return executecustomerInsuranceApplicationsIdGet(c);
}
