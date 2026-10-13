import type { Context } from 'hono';
import { executecustomerInsurancePlansGet } from '../services/customer_insurance_plans_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerInsurancePlansGetHandler(c: Context) {
  return executecustomerInsurancePlansGet(c);
}
