import type { Context } from 'hono';
import { executevendorsSearch } from '../services/vendors-search.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorsSearchHandler(c: Context) {
  return executevendorsSearch(c);
}
