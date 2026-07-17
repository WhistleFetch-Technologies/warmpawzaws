import type { Context } from 'hono';
import { executecustomerFacility } from '../services/customer-facility.service';

/** HTTP adapter — delegates to service layer. */
export async function customerFacilityHandler(c: Context) {
  return executecustomerFacility(c);
}
