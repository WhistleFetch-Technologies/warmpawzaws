import type { Context } from 'hono';
import { insuranceAdminError, insuranceAdminOk } from '../shared/insurance-admin-response';

export async function respond<T>(c: Context, run: () => Promise<T>, status: 200 | 201 = 200): Promise<Response> {
  try {
    return insuranceAdminOk(c, await run(), status);
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}
