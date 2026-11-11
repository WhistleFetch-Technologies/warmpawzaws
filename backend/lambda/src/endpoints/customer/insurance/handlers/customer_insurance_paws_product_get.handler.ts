import type { Context } from 'hono';
import { executecustomerInsurancePawsProductGet } from '../services/customer_insurance_paws_product_get.service';

export async function customerInsurancePawsProductGetHandler(c: Context) {
  return executecustomerInsurancePawsProductGet(c);
}
