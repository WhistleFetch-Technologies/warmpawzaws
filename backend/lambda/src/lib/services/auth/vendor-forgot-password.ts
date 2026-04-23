/**
 * Vendor forgot password: dedicated OTP purpose `vendor_password_reset`, rate limits, reset JWT.
 * Mirrors {@link customer-forgot-password} security and responses (generic success on request).
 * - UAT / non-prod OTP behavior: {@link isUatOtpModeForForgotPassword} (same as customer).
 * - Username resolves by phone ({@link findVendorForPasswordLogin}); if the string contains `@`,
 *   also matches `vendors.email` case-insensitively ({@link findVendorForForgotPassword}).
 *
 * TODO: Optional email magic-link reset — store hashed token + expiry in a `password_reset_tokens`
 * table (or SES link flow); deferred.
 *
 * Manual checks: unknown username returns same 200 + generic message as known; 429 when rate-capped;
 * verify-otp then reset succeeds; reusing resetToken after password change / auth_version bump → 401.
 */
import * as crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { query, insert } from '../../../database/rds-connection';
import { sendSMS } from '../../../utils/sms-service';
import {
  buildLoginOtpSmsBody,
  JIO_DLT_ENTITY_ID,
  JIO_LOGIN_OTP_SENDER_ID,
  JIO_LOGIN_OTP_TEMPLATE_ID,
} from '../../../constants/jio-login-otp-sms';
import {
  VendorForgotPasswordRequestSchema,
  VendorForgotPasswordVerifyOtpSchema,
  VendorForgotPasswordResetSchema,
} from '@warmpawz/api-contracts/auth';
import { hashCustomerPasswordBcrypt } from './customer-password-crypto';
import {
  selectVendorIdAndAuthVersion,
  updateVendorPasswordHashWithAuthVersionBump,
} from './vendor-auth-version-support';
import {
  dialablePhoneForCustomerAuth,
  normalizePhoneForOtp,
} from './customer-username-lookup';
import { findVendorForForgotPassword } from './vendor-username-lookup';
import { adminGlobalSignOutCognitoUserByDialablePhone } from '../../../utils/cognito-client';
import { isUatOtpModeForForgotPassword } from './customer-forgot-password';

export const VENDOR_PASSWORD_RESET_OTP_PURPOSE = 'vendor_password_reset';

const GENERIC_SUCCESS_MESSAGE = 'If an account exists, we sent instructions.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Try again later.';
const RESET_TOKEN_TTL_SEC = 12 * 60;

const SCOPE_SEND = 'vendor_password_reset_send';
const SCOPE_SEND_UNRESOLVED = 'vendor_password_reset_send_unresolved';
const SCOPE_VERIFY = 'vendor_password_reset_verify';

function resetJwtSecret(): Uint8Array {
  const s =
    process.env.PASSWORD_RESET_JWT_SECRET ||
    process.env.PROD_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.UAT_JWT_SECRET ||
    'uat-secret-key-change-in-production';
  return new TextEncoder().encode(s);
}

function usernameHashKey(username: string): string {
  const h = crypto.createHash('sha256').update(username.trim().toLowerCase()).digest('hex');
  return `unresolved:${h.slice(0, 32)}`;
}

function clientIp(headers: Record<string, string | undefined>): string {
  const xf = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (xf) return String(xf).split(',')[0]?.trim() || 'unknown';
  const cf = headers['cf-connecting-ip'] || headers['CF-Connecting-IP'];
  if (cf) return String(cf).trim();
  return 'unknown';
}

function isMissingAuthRateTableError(e: unknown): boolean {
  const m = String((e as any)?.message ?? e ?? '');
  const c = (e as any)?.code;
  if (c === '42P01' || c === 42) return true;
  return m.includes('auth_operation_rate_events') && /does not exist|not exist|undefined table/i.test(m);
}

async function countRateEvents(rateKey: string, scope: string, sinceSqlInterval: string): Promise<number> {
  const res = await query(
    `SELECT COUNT(*)::int AS c FROM auth_operation_rate_events
     WHERE rate_key = $1 AND operation_scope = $2 AND created_at > NOW() - $3::interval`,
    [rateKey, scope, sinceSqlInterval]
  );
  return Number((res as any).rows?.[0]?.c ?? 0);
}

async function lastEventTime(rateKey: string, scope: string): Promise<Date | null> {
  const res = await query(
    `SELECT created_at FROM auth_operation_rate_events
     WHERE rate_key = $1 AND operation_scope = $2
     ORDER BY created_at DESC LIMIT 1`,
    [rateKey, scope]
  );
  const t = (res as any).rows?.[0]?.created_at;
  return t ? new Date(t) : null;
}

async function recordRateEvent(rateKey: string, scope: string): Promise<void> {
  await insert('auth_operation_rate_events', {
    rate_key: rateKey,
    operation_scope: scope,
    created_at: new Date(),
  });
}

async function recordRateEventSafe(rateKey: string, scope: string): Promise<void> {
  try {
    await recordRateEvent(rateKey, scope);
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn('[vendor-forgot-password] recordRateEvent skipped (table missing). Run db/migrations/727_*.sql');
      return;
    }
    throw e;
  }
}

function rateErr(): Error {
  const err = new Error('RATE_LIMIT');
  (err as any).code = 'RATE_LIMIT';
  return err;
}

async function assertVendorForgotPasswordSendRate(params: {
  vendorId: string | null;
  usernameHash: string;
  ipKey: string;
}): Promise<void> {
  try {
    const { vendorId, usernameHash, ipKey } = params;
    if (vendorId) {
      const key = `vend:${vendorId}`;
      const h1 = await countRateEvents(key, SCOPE_SEND, '1 hour');
      if (h1 >= 3) throw rateErr();
      const d1 = await countRateEvents(key, SCOPE_SEND, '24 hours');
      if (d1 >= 5) throw rateErr();
      const last = await lastEventTime(key, SCOPE_SEND);
      if (last && Date.now() - last.getTime() < 60_000) throw rateErr();
      return;
    }
    const h10 = await countRateEvents(usernameHash, SCOPE_SEND_UNRESOLVED, '1 hour');
    if (h10 >= 10) throw rateErr();
    const iph = await countRateEvents(ipKey, SCOPE_SEND_UNRESOLVED, '1 hour');
    if (iph >= 40) throw rateErr();
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn(
        '[vendor-forgot-password] assertVendorForgotPasswordSendRate skipped (table missing). Run db/migrations/727_*.sql'
      );
      return;
    }
    throw e;
  }
}

async function assertVendorVerifyRateAllowed(vendorId: string | null, usernameHash: string): Promise<void> {
  try {
    if (vendorId) {
      const key = `vend:${vendorId}:v`;
      const n = await countRateEvents(key, SCOPE_VERIFY, '1 hour');
      if (n >= 20) throw rateErr();
    }
    const u = await countRateEvents(`${usernameHash}:verify`, SCOPE_VERIFY, '1 hour');
    if (u >= 30) throw rateErr();
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn(
        '[vendor-forgot-password] assertVendorVerifyRateAllowed skipped (table missing). Run db/migrations/727_*.sql'
      );
      return;
    }
    throw e;
  }
}

async function sendSmsForResetOtp(dialable: string, otpCode: string): Promise<boolean> {
  const message = buildLoginOtpSmsBody(otpCode);
  const result = await sendSMS({
    to: dialable,
    message,
    type: 'otp',
    templateId: JIO_LOGIN_OTP_TEMPLATE_ID,
    entityId: JIO_DLT_ENTITY_ID,
    senderId: JIO_LOGIN_OTP_SENDER_ID,
  });
  return result.success === true;
}

async function insertVendorPasswordResetOtp(canonicalPhone: string, code: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  await insert('otp_tokens', {
    phone: canonicalPhone,
    code,
    purpose: VENDOR_PASSWORD_RESET_OTP_PURPOSE,
    expires_at: expiresAt,
    is_used: false,
  });
}

export async function verifyVendorPasswordResetOtp(
  phone: string,
  code: string,
  allowUat123456 = false
): Promise<boolean> {
  if (code === '000000') return false;
  if (code === '123456' && allowUat123456) return true;
  if (code === '123456' && !allowUat123456) return false;
  const canonicalPhone = normalizePhoneForOtp(phone);
  const phonesToTry = [canonicalPhone];
  const alt = phone.replace(/\D/g, '').slice(-10);
  if (alt && alt !== canonicalPhone) phonesToTry.push(alt);
  if (phone !== canonicalPhone && phone !== alt) phonesToTry.push(phone);

  for (const p of phonesToTry) {
    const res = await query(
      `SELECT id, expires_at FROM otp_tokens
       WHERE phone = $1 AND code = $2 AND purpose = $3 AND is_used = false
       ORDER BY created_at DESC LIMIT 1`,
      [p, code, VENDOR_PASSWORD_RESET_OTP_PURPOSE]
    );
    const row = (res as any).rows?.[0];
    if (!row) continue;
    if (new Date(row.expires_at) < new Date()) return false;
    await query('UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1', [row.id]);
    return true;
  }
  return false;
}

async function readVendorAuthVersion(vendorId: string): Promise<number> {
  try {
    const res = await query(
      `SELECT COALESCE(auth_version, 0)::int AS av FROM vendors WHERE id = $1::uuid LIMIT 1`,
      [vendorId]
    );
    return Number((res as any).rows?.[0]?.av ?? 0);
  } catch {
    return 0;
  }
}

export async function issueVendorPasswordResetJwt(vendorId: string, authVersion: number): Promise<string> {
  const secret = resetJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    purpose: 'vendor_forgot_password_reset',
    auth_version: authVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(vendorId)
    .setIssuedAt(now)
    .setExpirationTime(now + RESET_TOKEN_TTL_SEC)
    .setIssuer('warmpawz-vendor-pwd-reset')
    .setAudience('warmpawz-vendor-password-reset')
    .sign(secret);
}

export async function verifyVendorPasswordResetJwt(token: string): Promise<
  | { ok: true; vendorId: string; authVersion: number }
  | { ok: false; error: string }
> {
  try {
    const secret = resetJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'warmpawz-vendor-pwd-reset',
      audience: 'warmpawz-vendor-password-reset',
    });
    const sub = String(payload.sub || '');
    if (!sub || !/^[0-9a-fA-F-]{36}$/.test(sub)) return { ok: false, error: 'INVALID_TOKEN' };
    if (payload.purpose !== 'vendor_forgot_password_reset') return { ok: false, error: 'INVALID_TOKEN' };
    const av = Number((payload as any).auth_version ?? 0);
    if (Number.isNaN(av)) return { ok: false, error: 'INVALID_TOKEN' };
    return { ok: true, vendorId: sub, authVersion: av };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'INVALID_TOKEN' };
  }
}

function envelopeSuccess(data: unknown, requestId: string) {
  return {
    success: true as const,
    data: {
      success: true as const,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: 'v1' as const,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1' as const,
    },
  };
}

function envelopeError(
  status: number,
  code: string,
  message: string,
  requestId: string
): { status: number; body: Record<string, unknown> } {
  return {
    status,
    body: {
      success: false,
      error: { code, message },
      meta: { timestamp: new Date().toISOString(), requestId, version: 'v1' },
    },
  };
}

export async function handleVendorForgotPasswordRequest(params: {
  body: unknown;
  requestId: string;
  headers: Record<string, string | undefined>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { body, requestId, headers } = params;
  const t0 = Date.now();
  const parsed = VendorForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    await sleepUntilMinDuration(t0);
    return { status: 400, body: envelopeError(400, 'VALIDATION_ERROR', 'Validation failed', requestId).body };
  }
  const username = parsed.data.username.trim();
  const ipKey = `ip:${clientIp(headers)}`;
  const uhash = usernameHashKey(username);

  try {
    const vendor = await findVendorForForgotPassword(username);
    await assertVendorForgotPasswordSendRate({
      vendorId: vendor?.id ? String(vendor.id) : null,
      usernameHash: uhash,
      ipKey,
    });

    if (vendor?.id) {
      const dialable = dialablePhoneForCustomerAuth(vendor.phone);
      if (!dialable || dialable.replace(/\D/g, '').length < 10) {
        console.warn('[vendor-forgot-password] vendor has no dialable phone; skipping SMS', vendor.id);
      } else {
        const isUatMode = isUatOtpModeForForgotPassword(headers);
        const otpCode = isUatMode
          ? '123456'
          : Math.floor(100000 + Math.random() * 900000).toString();
        const canon = normalizePhoneForOtp(dialable);
        await insertVendorPasswordResetOtp(canon, otpCode);
        if (isUatMode) {
          console.log(
            `[vendor-forgot-password] UAT: fixed OTP ${otpCode} stored, SMS skipped for vendor ${vendor.id}`
          );
        } else {
          const smsOk = await sendSmsForResetOtp(dialable, otpCode);
          if (!smsOk) {
            console.error('[vendor-forgot-password] SMS send failed for vendor', vendor.id);
          }
        }
      }
    }

    await recordRateEventSafe(uhash, SCOPE_SEND_UNRESOLVED);
    await recordRateEventSafe(ipKey, SCOPE_SEND_UNRESOLVED);
    if (vendor?.id) {
      await recordRateEventSafe(`vend:${vendor.id}`, SCOPE_SEND);
    }
  } catch (e: any) {
    if (e?.code === 'RATE_LIMIT' || e?.message === 'RATE_LIMIT') {
      await sleepUntilMinDuration(t0);
      return {
        status: 429,
        body: envelopeError(429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE, requestId).body,
      };
    }
    console.error('[vendor-forgot-password] request error:', e);
  }

  await sleepUntilMinDuration(t0);
  return { status: 200, body: envelopeSuccess({ message: GENERIC_SUCCESS_MESSAGE }, requestId) };
}

async function sleepUntilMinDuration(startMs: number, minMs = 400): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
}

export async function handleVendorForgotPasswordVerifyOtp(params: {
  body: unknown;
  requestId: string;
  headers?: Record<string, string | undefined>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { body, requestId, headers } = params;
  const t0 = Date.now();
  const parsed = VendorForgotPasswordVerifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    await sleepUntilMinDuration(t0);
    return { status: 400, body: envelopeError(400, 'VALIDATION_ERROR', 'Validation failed', requestId).body };
  }
  const { username, otp } = parsed.data;
  const uhash = usernameHashKey(username);
  const allowUat123456 = isUatOtpModeForForgotPassword(headers);

  try {
    const vendor = await findVendorForForgotPassword(username);
    await assertVendorVerifyRateAllowed(vendor?.id ? String(vendor.id) : null, uhash);
    await recordRateEventSafe(`${uhash}:verify`, SCOPE_VERIFY);
    if (vendor?.id) {
      await recordRateEventSafe(`vend:${vendor.id}:v`, SCOPE_VERIFY);
    }

    if (!vendor?.id) {
      await sleepUntilMinDuration(t0);
      return {
        status: 401,
        body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired OTP', requestId).body,
      };
    }

    const dialable = dialablePhoneForCustomerAuth(vendor.phone);
    const phoneForOtp = dialable || String(vendor.phone || '').trim();
    const ok = await verifyVendorPasswordResetOtp(phoneForOtp, otp, allowUat123456);

    if (!ok) {
      await sleepUntilMinDuration(t0);
      return {
        status: 401,
        body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired OTP', requestId).body,
      };
    }

    const authVersion = await readVendorAuthVersion(String(vendor.id));
    const resetToken = await issueVendorPasswordResetJwt(String(vendor.id), authVersion);

    await sleepUntilMinDuration(t0);
    return {
      status: 200,
      body: envelopeSuccess(
        {
          resetToken,
          expiresInSeconds: RESET_TOKEN_TTL_SEC,
        },
        requestId
      ),
    };
  } catch (e: any) {
    if (e?.code === 'RATE_LIMIT' || e?.message === 'RATE_LIMIT') {
      await sleepUntilMinDuration(t0);
      return {
        status: 429,
        body: envelopeError(429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE, requestId).body,
      };
    }
    console.error(
      '[vendor-forgot-password] verify error:',
      (e as any)?.message || e,
      (e as any)?.code,
      (e as any)?.stack
    );
    await sleepUntilMinDuration(t0);
    return {
      status: 500,
      body: envelopeError(500, 'INTERNAL_ERROR', 'Something went wrong', requestId).body,
    };
  }
}

export async function handleVendorForgotPasswordReset(params: {
  body: unknown;
  requestId: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { body, requestId } = params;
  const parsed = VendorForgotPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: envelopeError(400, 'VALIDATION_ERROR', 'Validation failed', requestId).body };
  }
  const { resetToken, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return {
      status: 400,
      body: envelopeError(400, 'VALIDATION_ERROR', 'Passwords do not match', requestId).body,
    };
  }
  if (newPassword.length < 8) {
    return {
      status: 400,
      body: envelopeError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters', requestId).body,
    };
  }

  const tok = await verifyVendorPasswordResetJwt(resetToken);
  if (!tok.ok) {
    return {
      status: 401,
      body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired reset link. Request a new code.', requestId).body,
    };
  }

  const row = await selectVendorIdAndAuthVersion(tok.vendorId);
  if (!row) {
    return {
      status: 401,
      body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired reset link. Request a new code.', requestId).body,
    };
  }
  if (Number(row.auth_version) !== tok.authVersion) {
    return {
      status: 401,
      body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired reset link. Request a new code.', requestId).body,
    };
  }

  const hash = await hashCustomerPasswordBcrypt(newPassword);
  await updateVendorPasswordHashWithAuthVersionBump(hash, tok.vendorId);

  const phoneRow = await query(`SELECT phone FROM vendors WHERE id = $1::uuid LIMIT 1`, [tok.vendorId]);
  const dbPhone = (phoneRow as any).rows?.[0]?.phone;
  const dialable = dialablePhoneForCustomerAuth(dbPhone);
  const signOut = await adminGlobalSignOutCognitoUserByDialablePhone(dialable);
  if (!signOut.ok) {
    console.warn('[vendor-forgot-password] Cognito global sign-out failed (password still updated):', signOut.error);
  }

  return {
    status: 200,
    body: envelopeSuccess({ ok: true }, requestId),
  };
}
