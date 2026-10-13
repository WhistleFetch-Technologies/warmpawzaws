import type { Context } from 'hono';
import { executecustomerInsuranceApplicationsIdFormGet } from '../services/customer_insurance_applications_id_form_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerInsuranceApplicationsIdFormGetHandler(c: Context) {
  return executecustomerInsuranceApplicationsIdFormGet(c);
}
