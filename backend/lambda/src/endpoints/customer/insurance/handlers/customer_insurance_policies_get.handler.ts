import type { Context } from 'hono';
import { executecustomerInsurancePoliciesGet } from '../services/customer_insurance_policies_get.service';

export async function customerInsurancePoliciesGetHandler(c: Context) {
  return executecustomerInsurancePoliciesGet(c);
}
