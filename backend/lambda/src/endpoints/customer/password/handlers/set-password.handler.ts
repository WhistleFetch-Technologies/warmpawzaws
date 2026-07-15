import type { Context } from 'hono';
import { query } from '../../../../database/rds-connection';
import { hashCustomerPasswordBcrypt } from '../../../../lib/services/auth/customer-password-crypto';
import { updateCustomerPasswordHashWithAuthVersionBump } from '../../../../lib/services/auth/customer-auth-version-support';
import { resolvePostgresCustomerIdFromAuthHeaders } from '../repos/customer-auth.repo';
import { authHeadersFromCustomerRequest, mergeHonoJsonBodyFromRequest } from '../utils/password-body.utils';

export async function handleCustomerSetPassword(c: Context) {
  const customerId = await resolvePostgresCustomerIdFromAuthHeaders(authHeadersFromCustomerRequest(c));
  if (!customerId) {
    return c.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }, meta: { version: 'v1' } },
      401
    );
  }

  const body = await mergeHonoJsonBodyFromRequest(c);
  const password = typeof body?.password === 'string' ? body.password : '';
  const confirmPassword =
    typeof body?.confirmPassword === 'string'
      ? body.confirmPassword
      : typeof body?.confirm_password === 'string'
        ? body.confirm_password
        : '';

  if (password.length < 8) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
      400
    );
  }
  if (password !== confirmPassword) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Passwords do not match' } },
      400
    );
  }

  const chk = await query(`SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`, [customerId]);
  if (!(chk as any).rows?.[0]) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  const hash = await hashCustomerPasswordBcrypt(password);
  await updateCustomerPasswordHashWithAuthVersionBump(hash, customerId);

  const phoneRow = await query(
    `SELECT phone FROM customers WHERE id = $1::uuid LIMIT 1`,
    [customerId]
  );
  const customerPhone = String((phoneRow as any).rows?.[0]?.phone || '');
  let freshToken: Record<string, unknown> | null = null;
  try {
    const { issueAuthTokensAfterOtp } = await import('../../../../lib/services/auth/vendor-otp-success-payload');
    const tokens = await issueAuthTokensAfterOtp({
      userId: customerId,
      phone: customerPhone,
      role: 'customer',
    });
    freshToken = {
      access_token: tokens.accessToken,
      id_token: tokens.idToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
    };
  } catch {
    // fresh token is optional; password was still saved
  }
  return c.json({
    success: true,
    data: { ok: true, ...(freshToken ? { token: freshToken } : {}) },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}
