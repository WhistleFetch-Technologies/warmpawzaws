import type { Context } from 'hono';
import { executehandleCustomerSetPassword } from '../services/set-password.service';

/** HTTP adapter — delegates to service layer. */
export async function handleCustomerSetPassword(c: Context) {
  return executehandleCustomerSetPassword(c);
}
