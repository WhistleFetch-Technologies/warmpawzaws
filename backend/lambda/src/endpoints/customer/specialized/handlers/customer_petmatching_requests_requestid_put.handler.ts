import type { Context } from 'hono';
import { executecustomerPetmatchingRequestsRequestidPut } from '../services/customer_petmatching_requests_requestid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetmatchingRequestsRequestidPutHandler(c: Context) {
  return executecustomerPetmatchingRequestsRequestidPut(c);
}
