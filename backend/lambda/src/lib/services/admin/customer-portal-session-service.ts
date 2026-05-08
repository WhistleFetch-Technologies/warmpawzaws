/**
 * Admin-initiated customer-web bootstrap: one-time codes + exchange at POST /auth/customer-portal-session.
 */
import { randomBytes } from 'crypto';
import { query, select, update } from '../../../database/rds-connection';
import { hasAdminPermission, resolveAdminPermissions } from '../../../utils/admin-rbac-permissions';
import { issueAuthTokensAfterOtp } from '../auth/vendor-otp-success-payload';
import { hasMeaningfulStoredPassword } from '../../../endpoints/customer/customerEndpoint/customer-password';

const CODE_TTL_SECONDS = 900;
const UAT_SYNTHETIC_ADMIN = 'uat-admin-user';

/** Ensures table exists when migrations were not applied to this RDS (idempotent, once per cold start). */
let ensurePortalCodesTablePromise: Promise<void> | null = null;

async function ensureCustomerAdminPortalCodesTable(): Promise<void> {
  if (!ensurePortalCodesTablePromise) {
    ensurePortalCodesTablePromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS customer_admin_portal_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS idx_customer_admin_portal_codes_customer_id ON customer_admin_portal_codes(customer_id)`
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_customer_admin_portal_codes_expires ON customer_admin_portal_codes(expires_at)`
      );
    })().catch((err) => {
      ensurePortalCodesTablePromise = null;
      throw err;
    });
  }
  await ensurePortalCodesTablePromise;
}

async function adminCanOpenCustomerPortal(adminId: string | undefined): Promise<boolean> {
  if (!adminId) return false;
  if (adminId === UAT_SYNTHETIC_ADMIN) return true;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(adminId)) return false;

  const r = await query('SELECT id, email, role FROM admins WHERE id = $1::uuid LIMIT 1', [adminId]);
  if (!r.rows?.length) return false;
  const row = r.rows[0] as { id: string; email?: string; role?: string };
  const perms = await resolveAdminPermissions(String(row.id), row.role, row.email);
  return (
    hasAdminPermission(perms, 'admin.full_access') ||
    hasAdminPermission(perms, 'admin.customers')
  );
}

export async function createCustomerPortalCode(params: {
  adminId: string | undefined;
  customerId: string;
}): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; error: string; status: number; errorCode?: string }
> {
  const { adminId, customerId } = params;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(customerId)) {
    return { ok: false, error: 'Invalid customer id', status: 400, errorCode: 'VALIDATION_ERROR' };
  }

  const allowed = await adminCanOpenCustomerPortal(adminId);
  if (!allowed) {
    return { ok: false, error: 'Forbidden', status: 403, errorCode: 'FORBIDDEN' };
  }

  const customers = await select('customers', { id: customerId });
  const customer = customers[0];
  if (!customer) {
    return { ok: false, error: 'Customer not found', status: 404, errorCode: 'NOT_FOUND' };
  }
  if (customer.is_active === false) {
    return { ok: false, error: 'Customer account is deactivated', status: 403, errorCode: 'CUSTOMER_DEACTIVATED' };
  }

  const phone = String(customer.phone || '').trim();
  if (!phone) {
    return { ok: false, error: 'Customer has no phone on file', status: 400, errorCode: 'MISSING_PHONE' };
  }

  await ensureCustomerAdminPortalCodesTable();

  const code = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  const adminUuid = adminId && uuidRe.test(adminId) ? adminId : null;

  await query(
    `INSERT INTO customer_admin_portal_codes (code, customer_id, created_by_admin_id, expires_at)
     VALUES ($1, $2::uuid, $3::uuid, $4::timestamptz)`,
    [code, customerId, adminUuid, expiresAt]
  );

  console.log(
    `[customer-portal-session] Created portal code for customer ${customerId} by admin ${adminId || 'unknown'}, expires ${expiresAt}`
  );

  return { ok: true, code, expiresAt };
}

/** Response body aligned with verify-otp customer branch for customer-web storage. */
export async function consumeCustomerPortalCodeAndBuildPayload(params: {
  code: string;
  requestId: string;
}): Promise<
  | {
      ok: true;
      data: {
        token: {
          access_token: string;
          id_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        };
        user: {
          id: string;
          phone: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        state: 'existing';
        profile: {
          id: string;
          phone: string;
          full_name: string | null;
          email: string | null;
          has_password: boolean;
          username: string;
        };
      };
    }
  | { ok: false; error: string; status: number; errorCode?: string }
> {
  const raw = (params.code || '').trim().toLowerCase();
  if (!raw) {
    return { ok: false, error: 'code is required', status: 400, errorCode: 'VALIDATION_ERROR' };
  }

  await ensureCustomerAdminPortalCodesTable();

  const upd = await query(
    `UPDATE customer_admin_portal_codes
     SET used_at = NOW()
     WHERE code = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING customer_id`,
    [raw]
  );

  if (!upd.rows?.length) {
    return { ok: false, error: 'Invalid or expired code', status: 401, errorCode: 'UNAUTHORIZED' };
  }

  const customerId = String(upd.rows[0].customer_id);

  const customers = await select('customers', { id: customerId });
  const customer = customers[0];
  if (!customer) {
    return { ok: false, error: 'Customer not found', status: 404, errorCode: 'NOT_FOUND' };
  }
  if (customer.is_active === false) {
    return { ok: false, error: 'Customer account is deactivated', status: 403, errorCode: 'CUSTOMER_DEACTIVATED' };
  }

  const phone = String(customer.phone || '').trim();
  if (!phone) {
    return { ok: false, error: 'Customer has no phone on file', status: 400, errorCode: 'MISSING_PHONE' };
  }

  try {
    await update(
      'customers',
      { id: customerId },
      { last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );
  } catch (e: unknown) {
    console.warn('[customer-portal-session] last_login_at update failed:', (e as Error)?.message);
  }

  const cognitoTokens = await issueAuthTokensAfterOtp({
    userId: customerId,
    phone,
    role: 'customer',
  });

  const username =
    typeof customer.username === 'string' && customer.username.trim()
      ? customer.username.trim()
      : phone.replace(/^\+91/, '').slice(-10);

  const profile = {
    id: customerId,
    phone,
    full_name: customer.full_name ?? null,
    email: customer.email ?? null,
    has_password: hasMeaningfulStoredPassword(customer.password_hash),
    username,
  };

  const data = {
    token: {
      access_token: cognitoTokens.accessToken,
      id_token: cognitoTokens.idToken,
      refresh_token: cognitoTokens.refreshToken,
      expires_in: cognitoTokens.expiresIn,
      token_type: 'Bearer',
    },
    user: {
      id: customerId,
      phone,
      role: 'customer',
      is_active: customer.is_active !== false,
      created_at: customer.created_at
        ? new Date(customer.created_at).toISOString()
        : new Date().toISOString(),
    },
    state: 'existing' as const,
    profile,
  };

  console.log(`[customer-portal-session] Consumed portal code for customer ${customerId}`);

  return { ok: true, data };
}
