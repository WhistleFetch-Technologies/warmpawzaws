/**
 * Admin-initiated vendor portal bootstrap: one-time codes + verify-otp-shaped exchange.
 */
import { randomBytes } from 'crypto';
import { query, select, update } from '../../../database/rds-connection';
import { hasAdminPermission, resolveAdminPermissions } from '../../../utils/admin-rbac-permissions';
import {
  issueAuthTokensAfterOtp,
  computeVendorIsNewUser,
  buildVerifyOtpVendorSuccessWrapper,
} from '../auth/vendor-otp-success-payload';

/** One-time portal link TTL (admin → vendor tab). Kept generous to avoid false "expired" during handoff. */
const CODE_TTL_SECONDS = 900;
const UAT_SYNTHETIC_ADMIN = 'uat-admin-user';

function isRecordDeleted(record: any): boolean {
  if (!record || record.is_deleted === undefined || record.is_deleted === null) return false;
  if (record.is_deleted === true) return true;
  if (record.is_deleted === 't') return true;
  if (typeof record.is_deleted === 'string' && record.is_deleted.toLowerCase() === 'true') return true;
  if (record.is_deleted === 1) return true;
  return false;
}

function isVendorDeactivated(vendor: any): boolean {
  return vendor.is_active === false && (vendor.status === 'suspended' || vendor.status === 'inactive');
}

async function adminCanOpenVendorPortal(adminId: string | undefined): Promise<boolean> {
  if (!adminId) return false;
  if (adminId === UAT_SYNTHETIC_ADMIN) return true;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(adminId)) return false;

  const r = await query('SELECT id, email, role FROM admins WHERE id = $1::uuid LIMIT 1', [adminId]);
  if (!r.rows?.length) return false;
  const row = r.rows[0] as { id: string; email?: string; role?: string };
  const perms = await resolveAdminPermissions(String(row.id), row.role, row.email);
  return hasAdminPermission(perms, 'admin.full_access') || hasAdminPermission(perms, 'admin.vendors');
}

export async function createVendorPortalCode(params: {
  adminId: string | undefined;
  vendorId: string;
}): Promise<
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: string; status: number; errorCode?: string }
> {
  const { adminId, vendorId } = params;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(vendorId)) {
    return { ok: false, error: 'Invalid vendor id', status: 400, errorCode: 'VALIDATION_ERROR' };
  }

  const allowed = await adminCanOpenVendorPortal(adminId);
  if (!allowed) {
    return { ok: false, error: 'Forbidden', status: 403, errorCode: 'FORBIDDEN' };
  }

  const vendors = await select('vendors', { id: vendorId });
  const vendor = vendors[0];
  if (!vendor || isRecordDeleted(vendor)) {
    return { ok: false, error: 'Vendor not found', status: 404, errorCode: 'NOT_FOUND' };
  }
  if (isVendorDeactivated(vendor)) {
    return { ok: false, error: 'Vendor account is deactivated', status: 403, errorCode: 'VENDOR_DEACTIVATED' };
  }

  const phone = (vendor.phone || '').trim();
  if (!phone) {
    return { ok: false, error: 'Vendor has no phone on file', status: 400, errorCode: 'MISSING_PHONE' };
  }

  const code = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  const adminUuid =
    adminId && uuidRe.test(adminId) ? adminId : null;

  await query(
    `INSERT INTO vendor_admin_portal_codes (code, vendor_id, created_by_admin_id, expires_at)
     VALUES ($1, $2::uuid, $3::uuid, $4::timestamptz)`,
    [code, vendorId, adminUuid, expiresAt]
  );

  console.log(
    `[vendor-portal-session] Created portal code for vendor ${vendorId} by admin ${adminId || 'unknown'}, expires ${expiresAt}`
  );

  return { ok: true, code, expiresAt };
}

export async function consumeVendorPortalCodeAndBuildPayload(params: {
  code: string;
  requestId: string;
}): Promise<
  | { ok: true; successBody: ReturnType<typeof buildVerifyOtpVendorSuccessWrapper> }
  | { ok: false; error: string; status: number; errorCode?: string }
> {
  const raw = (params.code || '').trim().toLowerCase();
  if (!raw) {
    return { ok: false, error: 'code is required', status: 400, errorCode: 'VALIDATION_ERROR' };
  }

  const upd = await query(
    `UPDATE vendor_admin_portal_codes
     SET used_at = NOW()
     WHERE code = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING vendor_id`,
    [raw]
  );

  if (!upd.rows?.length) {
    return { ok: false, error: 'Invalid or expired code', status: 401, errorCode: 'UNAUTHORIZED' };
  }

  const vendorId = String(upd.rows[0].vendor_id);

  const vendors = await select('vendors', { id: vendorId });
  const vendor = vendors[0];
  if (!vendor || isRecordDeleted(vendor)) {
    return { ok: false, error: 'Vendor not found', status: 404, errorCode: 'NOT_FOUND' };
  }
  if (isVendorDeactivated(vendor)) {
    return { ok: false, error: 'Vendor account is deactivated', status: 403, errorCode: 'VENDOR_DEACTIVATED' };
  }

  const phone = (vendor.phone || '').trim();
  if (!phone) {
    return { ok: false, error: 'Vendor has no phone on file', status: 400, errorCode: 'MISSING_PHONE' };
  }

  let vendorIdentity: any[] = [];
  try {
    vendorIdentity = await select('vendor_identity', { vendor_id: vendorId });
    if (vendorIdentity.length === 0) {
      vendorIdentity = await select('vendor_identity', { phone });
    }
  } catch {
    vendorIdentity = [];
  }
  vendorIdentity = (vendorIdentity || []).filter((vi: any) => !isRecordDeleted(vi));

  const userData: any = { ...vendor };
  if (vendorIdentity.length > 0) {
    userData.onboarding_status = vendorIdentity[0].onboarding_status;
    userData.vendor_identity_id = vendorIdentity[0].id;
  }

  const userId = vendor.id;

  try {
    await update(
      'vendors',
      { id: userId },
      { last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );
  } catch (e: any) {
    console.warn('[vendor-portal-session] last_login_at update failed:', e?.message);
  }

  const cognitoTokens = await issueAuthTokensAfterOtp({
    userId,
    phone,
    role: 'vendor',
  });

  const isNewUser = computeVendorIsNewUser(userId, userData);
  const wrapper = buildVerifyOtpVendorSuccessWrapper({
    cognitoTokens,
    userId,
    phone,
    userData,
    isNewUser,
    requestId: params.requestId,
  });

  // Match VendorAuth extras: role_id on profile for capabilities hooks
  if (userData.role_id) {
    (wrapper.data.profile as any).role_id = userData.role_id;
    (wrapper.data.profile as any).roleId = userData.role_id;
  }

  console.log(`[vendor-portal-session] Consumed portal code for vendor ${userId}`);

  return { ok: true, successBody: wrapper };
}
