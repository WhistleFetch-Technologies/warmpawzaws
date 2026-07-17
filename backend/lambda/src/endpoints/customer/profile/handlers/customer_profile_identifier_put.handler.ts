import type { Context } from 'hono';
import { executecustomerProfileIdentifierPut } from '../services/customer_profile_identifier_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerProfileIdentifierPutHandler(c: Context) {
  return executecustomerProfileIdentifierPut(c);
}
