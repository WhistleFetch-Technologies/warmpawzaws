/**
 * Vendor security: 2FA (TOTP in metadata), phone change (OTP), login history (audit_logs).
 */
import * as crypto from 'crypto';
import { query, select, update, insert } from '../../database/rds-connection';
import { sendSMS } from '../../utils/sms-service';
import {
  buildLoginOtpSmsBody,
  JIO_DLT_ENTITY_ID,
  JIO_LOGIN_OTP_SENDER_ID,
  JIO_LOGIN_OTP_TEMPLATE_ID,
} from '../../constants/jio-login-otp-sms';
import { normalizePhoneForOtp, dialablePhoneForCustomerAuth } from './auth/customer-username-lookup';
import {
  buildLoginAuditDetailsPayload,
  isPgMissingColumnError,
  isTempOrInvalidAuditId,
  isValidVendorUuid,
  mapLoginAuditRow,
  type VendorLoginEvent,
} from './vendor-login-audit';

export const VENDOR_PHONE_CHANGE_OTP_PURPOSE = 'vendor_phone_change';
export const VENDOR_PHONE_CHANGE_CURRENT_OTP_PURPOSE = 'vendor_phone_change_current';
export const VENDOR_PHONE_CHANGE_NEW_OTP_PURPOSE = 'vendor_phone_change_new';

export type { VendorLoginEvent };

const LOGIN_HISTORY_LIMIT = 50;
const PHONE_CHANGE_SESSION_MINUTES = 15;

export type VendorSecurityMeta = {
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  phoneVerified?: boolean;
  phoneChangeSession?: {
    verifiedAt: string;
    expiresAt: string;
  } | null;
};

function isRecordDeleted(record: Record<string, unknown> | null | undefined): boolean {
  if (!record) return false;
  const flag = record.is_deleted;
  if (flag === true || flag === 1) return true;
  if (flag === 't' || flag === 'true') return true;
  if (typeof flag === 'string' && flag.toLowerCase() === 'true') return true;
  return false;
}

function toIndianMobile10(phone: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function phoneSqlNormalize(field: string): string {
  return `RIGHT(REGEXP_REPLACE(COALESCE(${field}, ''), '[^0-9]', '', 'g'), 10)`;
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export async function getVendorSecurityMeta(vendorId: string): Promise<VendorSecurityMeta> {
  const rows = await select('vendors', { id: vendorId });
  if (!rows.length) return {};
  const meta = parseMetadata(rows[0].metadata);
  const sec = (meta.security as VendorSecurityMeta) || {};
  const phone = String(rows[0].phone || '').trim();
  const lastLogin = rows[0].last_login_at;
  return {
    twoFactorEnabled: !!sec.twoFactorEnabled,
    twoFactorSecret: sec.twoFactorSecret ?? null,
    phoneVerified: sec.phoneVerified !== false && !!phone && !!lastLogin,
  };
}

async function saveVendorSecurityMeta(vendorId: string, patch: Partial<VendorSecurityMeta>): Promise<void> {
  const rows = await select('vendors', { id: vendorId });
  if (!rows.length) throw new Error('Vendor not found');
  const meta = parseMetadata(rows[0].metadata);
  const current = ((meta.security as VendorSecurityMeta) || {}) as VendorSecurityMeta;
  meta.security = { ...current, ...patch };
  await update('vendors', { id: vendorId }, {
    metadata: meta,
    updated_at: new Date().toISOString(),
  });
}

/** RFC 4226 base32 decode (padding optional). */
function base32ToBuffer(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = secret.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const val = alphabet.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpCode(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpToken(secretBase32: string, token: string, window = 1): boolean {
  const code = String(token || '').replace(/\D/g, '');
  if (code.length !== 6) return false;
  let secretBuf: Buffer;
  try {
    secretBuf = base32ToBuffer(secretBase32);
  } catch {
    return false;
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (generateTotpCode(secretBuf, counter + w) === code) return true;
  }
  return false;
}

function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % 32];
  }
  return out;
}

export async function getVendorSecuritySnapshot(vendorId: string) {
  const loaded = await loadVendorRow(vendorId);
  if (!loaded) {
    return { error: 'Vendor not found', status: 404 as const };
  }
  const vendor = loaded.row;
  const meta = await getVendorSecurityMeta(loaded.canonicalId);
  const phone = String(vendor.phone || '').trim();
  const displayPhone = phone.replace(/\D/g, '').slice(-10) || phone;
  return {
    status: 200 as const,
    data: {
      vendorId: loaded.canonicalId,
      phone: displayPhone,
      phoneVerified: meta.phoneVerified ?? (!!phone && !!vendor.last_login_at),
      twoFactorEnabled: !!meta.twoFactorEnabled,
      accountSecured: !!(meta.phoneVerified ?? phone) && (meta.twoFactorEnabled || true),
      lastLoginAt: vendor.last_login_at || null,
    },
  };
}

export async function beginVendor2FASetup(vendorId: string) {
  const snap = await getVendorSecuritySnapshot(vendorId);
  if (snap.status !== 200) return snap;
  const secret = generateBase32Secret(20);
  await saveVendorSecurityMeta(vendorId, {
    twoFactorSecret: secret,
    twoFactorEnabled: false,
  });
  const label = encodeURIComponent(snap.data.phone || vendorId);
  const qrCodeUrl = `otpauth://totp/Warmpawz:${label}?secret=${secret}&issuer=Warmpawz`;
  return {
    status: 200 as const,
    data: {
      success: true,
      secret,
      qrCodeUrl,
      verificationRequired: true,
      message: 'Scan the QR code with your authenticator app, then enter the 6-digit code to enable 2FA.',
    },
  };
}

export async function confirmVendor2FA(vendorId: string, code: string) {
  const meta = await getVendorSecurityMeta(vendorId);
  if (!meta.twoFactorSecret) {
    return { status: 400 as const, error: '2FA setup not started. Call enable-2fa first.' };
  }
  if (!verifyTotpToken(meta.twoFactorSecret, code)) {
    return { status: 401 as const, error: 'Invalid verification code' };
  }
  await saveVendorSecurityMeta(vendorId, { twoFactorEnabled: true });
  return {
    status: 200 as const,
    data: { success: true, twoFactorEnabled: true, message: 'Two-factor authentication enabled.' },
  };
}

export async function disableVendor2FA(vendorId: string) {
  await saveVendorSecurityMeta(vendorId, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
  });
  return {
    status: 200 as const,
    data: { success: true, message: '2FA disabled successfully' },
  };
}

async function createPhoneChangeOtp(phone: string, code: string, purpose: string): Promise<void> {
  const canonicalPhone = normalizePhoneForOtp(phone);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);
  await insert('otp_tokens', {
    phone: canonicalPhone,
    code,
    purpose,
    expires_at: expiresAt,
    is_used: false,
  });
}

async function verifyPhoneChangeOtp(phone: string, code: string, purpose: string): Promise<boolean> {
  const canonicalPhone = normalizePhoneForOtp(phone);
  const isUAT = process.env.UAT_MODE === 'true';
  if (isUAT && (code === '123456' || code === '12345678')) return true;

  const res = await query(
    `SELECT id, expires_at FROM otp_tokens
     WHERE phone = $1 AND code = $2 AND purpose = $3 AND is_used = false
     ORDER BY created_at DESC LIMIT 1`,
    [canonicalPhone, code, purpose]
  );
  const row = (res as any).rows?.[0];
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  await query('UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1', [row.id]);
  return true;
}

async function sendPhoneChangeOtpSms(phoneDigits: string, otpCode: string): Promise<void> {
  const isUAT = process.env.UAT_MODE === 'true';
  if (isUAT) return;
  const dialable = dialablePhoneForCustomerAuth(phoneDigits);
  const message = buildLoginOtpSmsBody(otpCode);
  await sendSMS({
    to: dialable,
    message,
    type: 'otp',
    templateId: JIO_LOGIN_OTP_TEMPLATE_ID,
    entityId: JIO_DLT_ENTITY_ID,
    senderId: JIO_LOGIN_OTP_SENDER_ID,
  }).catch((e) => console.warn('[vendor-security] SMS failed:', e));
}

function generateOtpCode(): string {
  const isUAT = process.env.UAT_MODE === 'true';
  return isUAT ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
}

/** Resolve vendors.id (maps vendor_identity.id → vendor_id when linked). */
export async function resolveCanonicalVendorId(inputId: string): Promise<string | null> {
  return resolveCanonicalVendorIdForAudit(inputId);
}

async function loadVendorRow(vendorId: string): Promise<{ row: Record<string, unknown>; canonicalId: string } | null> {
  const canonicalId = await resolveCanonicalVendorId(vendorId);
  if (!canonicalId) return null;
  const rows = await select('vendors', { id: canonicalId });
  if (!rows.length || isRecordDeleted(rows[0])) return null;
  return { row: rows[0] as Record<string, unknown>, canonicalId };
}

async function getAccountScopedIds(canonicalVendorId: string): Promise<{
  vendorIds: string[];
  identityIds: string[];
}> {
  const vendorIds = new Set<string>([canonicalVendorId]);
  const identityIds = new Set<string>();

  try {
    const res = await query(
      `SELECT id, vendor_id FROM vendor_identity
       WHERE vendor_id = $1::uuid OR id = $1::uuid`,
      [canonicalVendorId]
    );
    for (const row of (res as any).rows || []) {
      if (row.id) identityIds.add(String(row.id));
      if (row.vendor_id) vendorIds.add(String(row.vendor_id));
    }
  } catch {
    /* vendor_identity may be unavailable in some envs */
  }

  return {
    vendorIds: Array.from(vendorIds),
    identityIds: Array.from(identityIds),
  };
}

async function findPhoneRegistrationConflict(
  phoneDigits: string,
  canonicalVendorId: string
): Promise<string | null> {
  const { vendorIds, identityIds } = await getAccountScopedIds(canonicalVendorId);
  const phoneNorm = phoneSqlNormalize('phone');

  try {
    const vendorRes = await query(
      `SELECT id FROM vendors
       WHERE ${phoneNorm} = $1
         AND COALESCE(is_deleted, false) IN (false, 'f', 'false')
         AND id::text <> ALL($2::text[])`,
      [phoneDigits, vendorIds]
    );
    if (((vendorRes as any).rows || []).length > 0) {
      return 'This phone number is already registered';
    }
  } catch (e) {
    console.warn('[vendor-security] vendor phone conflict check failed:', e);
  }

  try {
    const identityRes = await query(
      `SELECT id FROM vendor_identity
       WHERE ${phoneNorm} = $1
         AND COALESCE(is_deleted, false) IN (false, 'f', 'false')
         AND id::text <> ALL($2::text[])
         AND (vendor_id IS NULL OR vendor_id::text <> ALL($3::text[]))`,
      [phoneDigits, identityIds, vendorIds]
    );
    if (((identityRes as any).rows || []).length > 0) {
      return 'This phone number is already registered';
    }
  } catch (e) {
    console.warn('[vendor-security] vendor_identity phone conflict check failed:', e);
  }

  return null;
}

function isPhoneChangeSessionValid(meta: VendorSecurityMeta): boolean {
  const session = meta.phoneChangeSession;
  if (!session?.expiresAt) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

async function setPhoneChangeSession(canonicalVendorId: string): Promise<void> {
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + PHONE_CHANGE_SESSION_MINUTES * 60 * 1000);
  await saveVendorSecurityMeta(canonicalVendorId, {
    phoneChangeSession: {
      verifiedAt: verifiedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });
}

async function clearPhoneChangeSession(canonicalVendorId: string): Promise<void> {
  await saveVendorSecurityMeta(canonicalVendorId, { phoneChangeSession: null });
}

async function propagatePhoneChange(
  canonicalVendorId: string,
  newDigits: string,
  oldRawPhone: string
): Promise<void> {
  const old10 = toIndianMobile10(oldRawPhone) || '';
  const phoneNorm = phoneSqlNormalize('phone');

  await update('vendors', { id: canonicalVendorId }, {
    phone: newDigits,
    updated_at: new Date().toISOString(),
  });

  await query(
    `UPDATE vendor_identity
     SET phone = $1, updated_at = NOW()
     WHERE vendor_id = $2::uuid
        OR id IN (SELECT id FROM vendor_identity WHERE vendor_id = $2::uuid)
        OR ($3 <> '' AND ${phoneNorm} = $3)
        OR phone = $4`,
    [newDigits, canonicalVendorId, old10, oldRawPhone]
  ).catch((e) => console.warn('[vendor-security] vendor_identity phone propagate failed:', e));

  await clearPhoneChangeSession(canonicalVendorId);
}

/** Step 1: send OTP to the vendor's current phone to authorize a change. */
export async function sendCurrentPhoneChangeOtp(vendorId: string) {
  const loaded = await loadVendorRow(vendorId);
  if (!loaded) return { status: 404 as const, error: 'Vendor not found' };

  const currentDigits = toIndianMobile10(String(loaded.row.phone || ''));
  if (!currentDigits) {
    return { status: 400 as const, error: 'No valid phone number on file for this account' };
  }

  const otpCode = generateOtpCode();
  await createPhoneChangeOtp(currentDigits, otpCode, VENDOR_PHONE_CHANGE_CURRENT_OTP_PURPOSE);
  await sendPhoneChangeOtpSms(currentDigits, otpCode);

  return {
    status: 200 as const,
    data: {
      success: true,
      message:
        process.env.UAT_MODE === 'true'
          ? 'UAT: use OTP 123456 on your current number'
          : 'OTP sent to your current phone number',
      maskedPhone: `******${currentDigits.slice(-4)}`,
    },
  };
}

/** Step 2: verify OTP sent to current phone; unlocks new-number step for 15 minutes. */
export async function verifyCurrentPhoneForChange(vendorId: string, otp: string) {
  const loaded = await loadVendorRow(vendorId);
  if (!loaded) return { status: 404 as const, error: 'Vendor not found' };

  const currentDigits = toIndianMobile10(String(loaded.row.phone || ''));
  if (!currentDigits) {
    return { status: 400 as const, error: 'No valid phone number on file for this account' };
  }

  const valid = await verifyPhoneChangeOtp(
    currentDigits,
    otp,
    VENDOR_PHONE_CHANGE_CURRENT_OTP_PURPOSE
  );
  if (!valid) {
    return { status: 401 as const, error: 'Invalid or expired OTP' };
  }

  await setPhoneChangeSession(loaded.canonicalId);

  return {
    status: 200 as const,
    data: {
      success: true,
      message: 'Current phone verified. You can now enter your new number.',
    },
  };
}

export async function requestVendorPhoneChange(vendorId: string, newPhone: string) {
  const digits = toIndianMobile10(newPhone);
  if (!digits) {
    return { status: 400 as const, error: 'Enter a valid 10-digit Indian mobile number' };
  }

  const loaded = await loadVendorRow(vendorId);
  if (!loaded) return { status: 404 as const, error: 'Vendor not found' };

  const meta = await getVendorSecurityMeta(loaded.canonicalId);
  if (!isPhoneChangeSessionValid(meta)) {
    return {
      status: 403 as const,
      error: 'Verify your current phone number first before entering a new number',
    };
  }

  const currentDigits = toIndianMobile10(String(loaded.row.phone || ''));
  if (currentDigits && currentDigits === digits) {
    return { status: 400 as const, error: 'New phone number must be different from your current number' };
  }

  const conflict = await findPhoneRegistrationConflict(digits, loaded.canonicalId);
  if (conflict) {
    return { status: 409 as const, error: conflict };
  }

  const otpCode = generateOtpCode();
  await createPhoneChangeOtp(digits, otpCode, VENDOR_PHONE_CHANGE_NEW_OTP_PURPOSE);
  await sendPhoneChangeOtpSms(digits, otpCode);

  return {
    status: 200 as const,
    data: {
      success: true,
      message:
        process.env.UAT_MODE === 'true'
          ? 'UAT: use OTP 123456 on the new number'
          : 'OTP sent to the new phone number',
      maskedPhone: `******${digits.slice(-4)}`,
    },
  };
}

export async function confirmVendorPhoneChange(vendorId: string, newPhone: string, otp: string) {
  const digits = toIndianMobile10(newPhone);
  if (!digits) {
    return { status: 400 as const, error: 'Enter a valid 10-digit Indian mobile number' };
  }

  const loaded = await loadVendorRow(vendorId);
  if (!loaded) return { status: 404 as const, error: 'Vendor not found' };

  const meta = await getVendorSecurityMeta(loaded.canonicalId);
  if (!isPhoneChangeSessionValid(meta)) {
    return {
      status: 403 as const,
      error: 'Phone change session expired. Verify your current number again.',
    };
  }

  const conflict = await findPhoneRegistrationConflict(digits, loaded.canonicalId);
  if (conflict) {
    return { status: 409 as const, error: conflict };
  }

  const valid = await verifyPhoneChangeOtp(digits, otp, VENDOR_PHONE_CHANGE_NEW_OTP_PURPOSE);
  if (!valid) {
    return { status: 401 as const, error: 'Invalid or expired OTP' };
  }

  const oldRawPhone = String(loaded.row.phone || '');
  await propagatePhoneChange(loaded.canonicalId, digits, oldRawPhone);
  await saveVendorSecurityMeta(loaded.canonicalId, { phoneVerified: true });

  return {
    status: 200 as const,
    data: { success: true, phone: digits, message: 'Phone number updated successfully' },
  };
}

/** Resolve vendors.id for audit_logs (maps vendor_identity.id → vendor_id when linked). */
export async function resolveCanonicalVendorIdForAudit(
  inputId: string
): Promise<string | null> {
  if (isTempOrInvalidAuditId(inputId)) return null;

  const vendors = await select('vendors', { id: inputId });
  if (vendors.length > 0) return inputId;

  const identities = await select('vendor_identity', { id: inputId });
  if (identities.length > 0) {
    const linked = identities[0].vendor_id;
    return linked && isValidVendorUuid(String(linked)) ? String(linked) : null;
  }

  return null;
}

async function insertVendorLoginAuditRow(
  canonicalVendorId: string,
  details: { ip?: string; userAgent?: string; method?: string }
): Promise<void> {
  const payload = buildLoginAuditDetailsPayload(details);
  const createdAt = new Date();

  try {
    await insert('audit_logs', {
      entity_type: 'vendor',
      entity_id: canonicalVendorId,
      action: 'login',
      actor_id: canonicalVendorId,
      actor_type: 'vendor',
      changes: payload,
      created_at: createdAt,
    });
    return;
  } catch (primaryErr) {
    if (!isPgMissingColumnError(primaryErr)) throw primaryErr;
  }

  await insert('audit_logs', {
    entity_type: 'vendor',
    entity_id: canonicalVendorId,
    action: 'login',
    actor_id: canonicalVendorId,
    actor_role: 'vendor',
    details: payload,
    ip_address: details.ip && details.ip !== 'unknown' ? details.ip : null,
    user_agent: details.userAgent || null,
    created_at: createdAt,
  });
}

export async function recordVendorLoginEvent(
  vendorId: string,
  details: { ip?: string; userAgent?: string; method?: string }
): Promise<void> {
  try {
    const canonicalId = await resolveCanonicalVendorIdForAudit(vendorId);
    if (!canonicalId) return;

    await insertVendorLoginAuditRow(canonicalId, details);
    await saveVendorSecurityMeta(canonicalId, { phoneVerified: true }).catch(() => {});
  } catch (e) {
    const message = (e as Error)?.message || String(e);
    console.warn('[vendor-security] recordVendorLoginEvent failed', {
      vendorId: vendorId?.startsWith('temp_') ? 'temp' : vendorId,
      error: message,
    });
  }
}

export async function getVendorLoginHistory(vendorId: string, limit = 20): Promise<VendorLoginEvent[]> {
  if (!isValidVendorUuid(vendorId)) return [];

  const capped = Math.min(Math.max(limit, 1), LOGIN_HISTORY_LIMIT);
  try {
    const res = await query(
      `SELECT id, created_at,
              COALESCE(changes, details) AS payload,
              ip_address, user_agent
       FROM audit_logs
       WHERE action = 'login'
         AND entity_type = 'vendor'
         AND (
           entity_id = $1::uuid
           OR entity_id IN (
             SELECT id FROM vendor_identity WHERE vendor_id = $1::uuid
           )
         )
       ORDER BY created_at DESC
       LIMIT $2`,
      [vendorId, capped]
    );
    return ((res as any).rows || []).map((row: any) =>
      mapLoginAuditRow({
        id: row.id,
        created_at: row.created_at,
        payload: row.payload,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
      })
    );
  } catch (e) {
    console.warn('[vendor-security] getVendorLoginHistory failed', {
      vendorId,
      error: (e as Error)?.message,
    });
    return [];
  }
}

export function clientIpFromHeaders(headers: Record<string, string | undefined>): string {
  const xf = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (xf) return String(xf).split(',')[0]?.trim() || 'unknown';
  return headers['cf-connecting-ip'] || headers['CF-Connecting-IP'] || 'unknown';
}
