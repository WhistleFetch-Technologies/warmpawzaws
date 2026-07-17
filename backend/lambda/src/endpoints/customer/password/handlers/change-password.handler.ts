import type { Context } from 'hono';
import { executeChangePassword } from '../services/change-password.service';

/** HTTP adapter — delegates to service layer. */
export async function changePasswordHandler(c: Context) {
  return executeChangePassword(c);
}
