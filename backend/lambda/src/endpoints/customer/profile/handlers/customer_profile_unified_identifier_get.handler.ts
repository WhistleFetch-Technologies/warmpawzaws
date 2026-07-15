import type { Context } from 'hono';
import { executecustomerProfileUnifiedIdentifierGet } from '../services/customer_profile_unified_identifier_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerProfileUnifiedIdentifierGetHandler(c: Context) {
  return executecustomerProfileUnifiedIdentifierGet(c);
}
