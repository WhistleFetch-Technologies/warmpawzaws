import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';

export type WpayAuthenticatedCustomer =
  | { ok: true; customerId: string }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/**
 * Bind WPay initiate/verify to the JWT customer.
 * Body phone must resolve to the same customer; mismatch is rejected.
 */
export async function resolveWpayAuthenticatedCustomer(
  c: Context,
  phone: string,
): Promise<WpayAuthenticatedCustomer> {
  const authCustomerId = await resolveCustomerIdFromHonoContext(c);
  if (!authCustomerId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const trimmed = String(phone || '').trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: 'Phone is required' };
  }

  const phoneCustomerId = await resolveCustomerIdFromPhone(trimmed);
  if (!phoneCustomerId) {
    return { ok: false, status: 404, error: 'Customer not found' };
  }
  if (phoneCustomerId !== authCustomerId) {
    return { ok: false, status: 403, error: 'Phone does not match authenticated customer' };
  }

  return { ok: true, customerId: authCustomerId };
}
