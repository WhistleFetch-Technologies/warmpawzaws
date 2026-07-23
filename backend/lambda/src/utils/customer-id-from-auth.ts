import type { Context } from 'hono';
import { resolvePostgresCustomerIdFromAuthHeaders } from '../endpoints/customer/password/repos/customer-auth.repo';
import { isValidUUID } from '../types/entities';

export function authHeadersFromHonoRequest(c: Context): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (auth) headers.authorization = auth;
  const uatM = c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode');
  if (uatM) headers['x-uat-mode'] = uatM;
  return headers;
}

/**
 * Resolve orders.customer_id for shop cancel/refund flows.
 * UAT opaque tokens set userId to uat-customer-user; map via phone/JWT claims instead.
 */
export async function resolveCustomerIdFromHonoContext(c: Context): Promise<string | null> {
  const resolved = await resolvePostgresCustomerIdFromAuthHeaders(authHeadersFromHonoRequest(c));
  if (resolved) return resolved;

  const userId = String(c.get('userId') || '').trim();
  return isValidUUID(userId) ? userId : null;
}
