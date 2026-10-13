import type { Context } from 'hono';
import { executecustomerInsurancePlansIdGet } from '../services/customer_insurance_plans_id_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerInsurancePlansIdGetHandler(c: Context) {
  return executecustomerInsurancePlansIdGet(c);
}
