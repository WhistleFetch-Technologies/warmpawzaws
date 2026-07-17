import type { Context } from 'hono';
import { executecustomerPetmatchingRequestsGet } from '../services/customer_petmatching_requests_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetmatchingRequestsGetHandler(c: Context) {
  return executecustomerPetmatchingRequestsGet(c);
}
