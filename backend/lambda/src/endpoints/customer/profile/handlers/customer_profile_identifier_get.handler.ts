import type { Context } from 'hono';
import { executecustomerProfileIdentifierGet } from '../services/customer_profile_identifier_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerProfileIdentifierGetHandler(c: Context) {
  return executecustomerProfileIdentifierGet(c);
}
