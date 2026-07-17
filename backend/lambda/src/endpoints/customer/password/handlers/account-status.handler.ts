import type { Context } from 'hono';
import { executehandleCustomerAccountStatus } from '../services/account-status.service';

/** HTTP adapter — delegates to service layer. */
export async function handleCustomerAccountStatus(c: Context) {
  return executehandleCustomerAccountStatus(c);
}
