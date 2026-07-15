import type { Context } from 'hono';
import { executecustomerPhonePetskillsGet } from '../services/customer_phone_petskills_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhonePetskillsGetHandler(c: Context) {
  return executecustomerPhonePetskillsGet(c);
}
