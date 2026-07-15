import type { Context } from 'hono';
import { executeservicesByStyle } from '../services/services-by-style.service';

/** HTTP adapter — delegates to service layer. */
export async function servicesByStyleHandler(c: Context) {
  return executeservicesByStyle(c);
}
