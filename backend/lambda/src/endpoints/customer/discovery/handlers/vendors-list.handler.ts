import type { Context } from 'hono';
import { executevendorsList } from '../services/vendors-list.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorsListHandler(c: Context) {
  return executevendorsList(c);
}
