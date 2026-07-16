import type { Context } from 'hono';
import * as account_statusRepo from '../repos/account-status.repo';
import { resolvePostgresCustomerIdFromAuthHeaders } from '../repos/customer-auth.repo';
import { authHeadersFromCustomerRequest } from '../services/password-body.utils';
import { hasMeaningfulStoredPassword } from '../services/password-hash.utils';

export async function executehandleCustomerAccountStatus(c: Context) {
  try {
    const customerId = await resolvePostgresCustomerIdFromAuthHeaders(authHeadersFromCustomerRequest(c));
    if (!customerId) {
      return c.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }, meta: { version: 'v1' } },
        401
      );
    }

    const rows = await account_statusRepo.dbAccountStatus0(customerId);
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
  } catch (error: any) {
    console.error('Error fetching customer account status:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Internal error' }, meta: { version: 'v1' } },
      500
    );
  }
}