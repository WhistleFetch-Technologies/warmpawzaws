import type { Context } from 'hono';
import { query } from '../../../../database/rds-connection';
import { resolvePostgresCustomerIdFromAuthHeaders } from '../repos/customer-auth.repo';
import { authHeadersFromCustomerRequest } from '../services/password-body.utils';
import { hasMeaningfulStoredPassword } from '../services/password-hash.utils';

export async function handleCustomerAccountStatus(c: Context) {
  const customerId = await resolvePostgresCustomerIdFromAuthHeaders(authHeadersFromCustomerRequest(c));
  if (!customerId) {
    return c.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }, meta: { version: 'v1' } },
      401
    );
  }

  const rows = await query(
    `SELECT id, username, phone, password_hash, profile_completed, onboarding_status, password_set_at
     FROM customers WHERE id = $1::uuid LIMIT 1`,
    [customerId]
  );
  const row = (rows as any).rows?.[0];
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const hasPwd = hasMeaningfulStoredPassword(row.password_hash);

  return c.json({
    success: true,
    data: {
      customer_id: row.id,
      username: row.username || null,
      has_password: hasPwd,
      profile_completed: row.profile_completed === true,
      onboarding_status: row.onboarding_status || null,
      needs_password_setup: !hasPwd,
    },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}
