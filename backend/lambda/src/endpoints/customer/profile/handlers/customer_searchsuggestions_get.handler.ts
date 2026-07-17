import type { Context } from 'hono';
import { executecustomerSearchsuggestionsGet } from '../services/customer_searchsuggestions_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerSearchsuggestionsGetHandler(c: Context) {
  return executecustomerSearchsuggestionsGet(c);
}
