/**
 * Customer-only forgot password: dedicated OTP purpose, rate limits, reset JWT.
 * Does not use generic /auth/send-otp paths for storage semantics.
 * - **Non-production** deployments (see `isCustomerAuthProductionDeployment`): fixed OTP 123456, no SMS, verify accepts 123456 without `otp_tokens` (same UX as signup UAT).
 * - **Production**: real SMS OTP only; fixed OTP is off unless `UAT_MODE=true` on the server (never enable that on prod). Client headers cannot turn on magic OTP on prod.
 */
import * as crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { query, insert } from '../../../database/rds-connection';
import {
  CustomerForgotPasswordRequestSchema,
  CustomerForgotPasswordVerifyOtpSchema,
  CustomerForgotPasswordResetSchema,
} from '@warmpawz/api-contracts/auth';
import { hashCustomerPasswordBcrypt } from './customer-password-crypto';
import {
  selectCustomerIdAndAuthVersion,
  updateCustomerPasswordHashWithAuthVersionBump,
} from './customer-auth-version-support';
import {
  dialablePhoneForCustomerAuth,
  findCustomerForPasswordLogin,
  normalizePhoneForOtp,
} from './customer-username-lookup';
import { adminGlobalSignOutCognitoUserByDialablePhone } from '../../../utils/cognito-client';
import {
  insertOtpWithTimeout,
  sendResetOtpSmsWithTimeout,
  type OtpDeliveryFailureReason,
} from './otp-delivery-timeouts';
import {
  PASSWORD_RESET_SEND_COOLDOWN_MS,
  PASSWORD_RESET_SEND_COOLDOWN_SEC,
  buildRateLimitResponse,
  rateLimitErrorForCooldown,
  rateLimitErrorForDailyCap,
  rateLimitErrorForHourlyCap,
  readRateLimitRetryAfterSeconds,
  type ForgotPasswordHandlerResult,
} from './forgot-password-rate-limit';

export const CUSTOMER_PASSWORD_RESET_OTP_PURPOSE = 'customer_password_reset';

const GENERIC_SUCCESS_MESSAGE = 'If an account exists, we sent instructions.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Try again later.';
const RESET_TOKEN_TTL_SEC = 12 * 60; // 12 minutes

const SCOPE_SEND = 'customer_password_reset_send';
const SCOPE_SEND_UNRESOLVED = 'customer_password_reset_send_unresolved';
const SCOPE_VERIFY = 'customer_password_reset_verify';

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

/**
 * Customer-facing **production** API — used to keep fixed OTP off unless the server explicitly sets UAT_MODE.
 * Do not treat `NODE_ENV=production` alone as ambiguous: CDK sets `development` for non-prod; Serverless sets
 * `NODE_ENV` to the **stage name** (e.g. `dev`, `prod`). Prefer STAGE / Lambda name when present.
 */
export function isCustomerAuthProductionDeployment(): boolean {
  const stage = (process.env.STAGE || process.env.SLS_STAGE || '').toLowerCase();
  if (['prod', 'production', 'prd', 'main'].includes(stage)) return true;

  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (['prod', 'production'].includes(env)) return true;

  const n = (process.env.NODE_ENV || '').toLowerCase();
  if (['prod', 'production', 'prd', 'main'].includes(n)) return true;

  const fn = (process.env.AWS_LAMBDA_FUNCTION_NAME || '').toLowerCase();
  if (fn && /prod/.test(fn) && !/(dev|uat|staging|stage|test)/.test(fn)) return true;

  return false;
}

/**
 * When true: fixed OTP 123456, skip SMS on request, accept 123456 on verify without DB row.
 * - Non-prod deployment: always true (dev/stage bypass).
 * - Prod deployment: only when `UAT_MODE=true` (should never be set on real prod).
 */
export function isUatOtpModeForForgotPassword(_headers?: Record<string, string | undefined>): boolean {
  if (process.env.UAT_MODE === 'true') return true;
  if (isCustomerAuthProductionDeployment()) return false;
  return true;
}

function isMissingAuthRateTableError(e: unknown): boolean {
  const m = String((e as any)?.message ?? e ?? '');
  const c = (e as any)?.code;
  if (c === '42P01' || c === 42) return true;
  return m.includes('auth_operation_rate_events') && /does not exist|not exist|undefined table/i.test(m);
}

async function countRateEvents(rateKey: string, scope: string, sinceSqlInterval: string): Promise<number> {
  // Bind interval as a parameter — `NOW() - 1 hour::interval` is invalid SQL (parsed as `1` minus `hour`).
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

/** Avoid 500s if `auth_operation_rate_events` migration was not applied yet. */
async function recordRateEventSafe(rateKey: string, scope: string): Promise<void> {
  try {
    await recordRateEvent(rateKey, scope);
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn('[forgot-password] recordRateEvent skipped (table missing). Run db/migrations/727_*.sql');
      return;
    }
    throw e;
  }
}

/** Primary: per-customer OTP send caps. Unresolved: per username-hash + IP (no account enumeration). */
async function assertForgotPasswordSendRate(params: {
  customerId: string | null;
  usernameHash: string;
  ipKey: string;
}): Promise<void> {
  try {
    const { customerId, usernameHash, ipKey } = params;
    if (customerId) {
      const key = `cust:${customerId}`;
      const h1 = await countRateEvents(key, SCOPE_SEND, '1 hour');
      if (h1 >= 3) throw rateLimitErrorForHourlyCap();
      const d1 = await countRateEvents(key, SCOPE_SEND, '24 hours');
      if (d1 >= 5) throw rateLimitErrorForDailyCap();
      const last = await lastEventTime(key, SCOPE_SEND);
      if (last && Date.now() - last.getTime() < PASSWORD_RESET_SEND_COOLDOWN_MS) {
        throw rateLimitErrorForCooldown(last);
      }
      return;
    }
    const h10 = await countRateEvents(usernameHash, SCOPE_SEND_UNRESOLVED, '1 hour');
    if (h10 >= 10) throw rateLimitErrorForHourlyCap();
    const iph = await countRateEvents(ipKey, SCOPE_SEND_UNRESOLVED, '1 hour');
    if (iph >= 40) throw rateLimitErrorForHourlyCap();
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn(
        '[forgot-password] assertForgotPasswordSendRate skipped (table missing). Run db/migrations/727_*.sql'
      );
      return;
    }
    throw e;
  }
}

async function assertVerifyRateAllowed(customerId: string | null, usernameHash: string): Promise<void> {
  try {
    if (customerId) {
      const key = `cust:${customerId}:v`;
      const n = await countRateEvents(key, SCOPE_VERIFY, '1 hour');
      if (n >= 20) throw rateLimitErrorForHourlyCap();
    }
    const u = await countRateEvents(`${usernameHash}:verify`, SCOPE_VERIFY, '1 hour');
    if (u >= 30) throw rateLimitErrorForHourlyCap();
  } catch (e) {
    if (isMissingAuthRateTableError(e)) {
      console.warn(
        '[forgot-password] assertVerifyRateAllowed skipped (table missing). Run db/migrations/727_*.sql'
      );
      return;
    }
    throw e;
  }
}

async function insertPasswordResetOtp(canonicalPhone: string, code: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  await insert('otp_tokens', {
    phone: canonicalPhone,
    code,
    purpose: CUSTOMER_PASSWORD_RESET_OTP_PURPOSE,
    expires_at: expiresAt,
    is_used: false,
  });
}

async function deliverPasswordResetOtp(params: {
  requestId: string;
  accountId: string;
  dialable: string;
  headers: Record<string, string | undefined>;
}): Promise<void> {
  const { requestId, accountId, dialable, headers } = params;
  const deliveryLog: {
    requestId: string;
    accountResolved: boolean;
    otpStored: boolean;
    smsAccepted: boolean;
    failureReason?: OtpDeliveryFailureReason;
  } = {
    requestId,
    accountResolved: true,
    otpStored: false,
    smsAccepted: false,
  };

  try {
    const isUatMode = isUatOtpModeForForgotPassword(headers);
    const otpCode = isUatMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const canon = normalizePhoneForOtp(dialable);

    const insertResult = await insertOtpWithTimeout(() => insertPasswordResetOtp(canon, otpCode));
    if (!insertResult.ok) {
      deliveryLog.failureReason = insertResult.reason;
      console.error('[forgot-password] OTP store failed', { ...deliveryLog, customerId: accountId });
      return;
    }
    deliveryLog.otpStored = true;

    if (isUatMode) {
      console.log(
        `[forgot-password] UAT_MODE: fixed OTP stored, SMS skipped for customer ${accountId}`
      );
      return;
    }

    const smsResult = await sendResetOtpSmsWithTimeout(dialable, otpCode);
    deliveryLog.smsAccepted = smsResult.ok;
    if (!smsResult.ok) {
      deliveryLog.failureReason = smsResult.reason;
      console.error('[forgot-password] SMS delivery failed', { ...deliveryLog, customerId: accountId });
    }
  } catch (e) {
    console.error('[forgot-password] delivery error', { ...deliveryLog, customerId: accountId, error: e });
  }
}

/**
 * Strict OTP verify: purpose must match. Never allow 000000 (forgot path must not mirror prod login bypass).
 * `allowUat123456` (UAT_MODE env, or non-prod stage + `x-uat-mode: true`): accept fixed **123456** without an
 * `otp_tokens` row — same UX as POST /auth/verify-otp in UAT (avoids SMS/DB drift and UPDATE errors on dev DBs).
 * Production: `allowUat123456` is false unless `UAT_MODE=true`; magic OTP never works from header alone on prod.
 */
export async function verifyPasswordResetOtp(
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
      [p, code, CUSTOMER_PASSWORD_RESET_OTP_PURPOSE]
    );
    const row = (res as any).rows?.[0];
    if (!row) continue;
    if (new Date(row.expires_at) < new Date()) return false;
    await query('UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1', [row.id]);
    return true;
  }
  return false;
}

async function readCustomerAuthVersion(customerId: string): Promise<number> {
  try {
    const res = await query(
      `SELECT COALESCE(auth_version, 0)::int AS av FROM customers WHERE id = $1::uuid LIMIT 1`,
      [customerId]
    );
    return Number((res as any).rows?.[0]?.av ?? 0);
  } catch {
    return 0;
  }
}

export async function issuePasswordResetJwt(customerId: string, authVersion: number): Promise<string> {
  const secret = resetJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    purpose: 'customer_forgot_password_reset',
    auth_version: authVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(customerId)
    .setIssuedAt(now)
    .setExpirationTime(now + RESET_TOKEN_TTL_SEC)
    .setIssuer('warmpawz-customer-pwd-reset')
    .setAudience('warmpawz-password-reset')
    .sign(secret);
}

export async function verifyPasswordResetJwt(token: string): Promise<{
  ok: true;
  customerId: string;
  authVersion: number;
} | { ok: false; error: string }> {
  try {
    const secret = resetJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'warmpawz-customer-pwd-reset',
      audience: 'warmpawz-password-reset',
    });
    const sub = String(payload.sub || '');
    if (!sub || !/^[0-9a-fA-F-]{36}$/.test(sub)) return { ok: false, error: 'INVALID_TOKEN' };
    if (payload.purpose !== 'customer_forgot_password_reset') return { ok: false, error: 'INVALID_TOKEN' };
    const av = Number((payload as any).auth_version ?? 0);
    if (Number.isNaN(av)) return { ok: false, error: 'INVALID_TOKEN' };
    return { ok: true, customerId: sub, authVersion: av };
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

export async function handleCustomerForgotPasswordRequest(params: {
  body: unknown;
  requestId: string;
  headers: Record<string, string | undefined>;
}): Promise<ForgotPasswordHandlerResult> {
  const { body, requestId, headers } = params;
  const t0 = Date.now();
  const parsed = CustomerForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    await sleepUntilMinDuration(t0);
    return { status: 400, body: envelopeError(400, 'VALIDATION_ERROR', 'Validation failed', requestId).body };
  }
  const username = parsed.data.username.trim();
  const ipKey = `ip:${clientIp(headers)}`;
  const uhash = usernameHashKey(username);

  try {
    const customer = await findCustomerForPasswordLogin(username);
    await assertForgotPasswordSendRate({
      customerId: customer?.id ? String(customer.id) : null,
      usernameHash: uhash,
      ipKey,
    });

    if (customer?.id) {
      const dialable = dialablePhoneForCustomerAuth(customer.phone);
      if (!dialable || dialable.replace(/\D/g, '').length < 10) {
        console.warn('[forgot-password] customer has no dialable phone; skipping SMS', customer.id);
      } else {
        await deliverPasswordResetOtp({
          requestId,
          accountId: String(customer.id),
          dialable,
          headers,
        });
      }
    }

    await recordRateEventSafe(uhash, SCOPE_SEND_UNRESOLVED);
    await recordRateEventSafe(ipKey, SCOPE_SEND_UNRESOLVED);
    if (customer?.id) {
      await recordRateEventSafe(`cust:${customer.id}`, SCOPE_SEND);
    }
  } catch (e: any) {
    if (e?.code === 'RATE_LIMIT' || e?.message === 'RATE_LIMIT') {
      await sleepUntilMinDuration(t0);
      const retryAfterSeconds = readRateLimitRetryAfterSeconds(e);
      return buildRateLimitResponse({
        requestId,
        retryAfterSeconds,
        message: RATE_LIMIT_MESSAGE,
        errorBody: envelopeError(429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE, requestId).body,
      });
    }
    console.error('[forgot-password] request error:', e);
    return {
      status: 503,
      body: envelopeError(503, 'SERVICE_UNAVAILABLE', 'Something went wrong. Try again.', requestId).body,
    };
  }

  await sleepUntilMinDuration(t0);
  return {
    status: 200,
    body: envelopeSuccess(
      { message: GENERIC_SUCCESS_MESSAGE, retryAfterSeconds: PASSWORD_RESET_SEND_COOLDOWN_SEC },
      requestId
    ),
  };
}

async function sleepUntilMinDuration(startMs: number, minMs = 400): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
}

export async function handleCustomerForgotPasswordVerifyOtp(params: {
  body: unknown;
  requestId: string;
  headers?: Record<string, string | undefined>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { body, requestId, headers } = params;
  const t0 = Date.now();
  const parsed = CustomerForgotPasswordVerifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    await sleepUntilMinDuration(t0);
    return { status: 400, body: envelopeError(400, 'VALIDATION_ERROR', 'Validation failed', requestId).body };
  }
  const { username, otp } = parsed.data;
  const uhash = usernameHashKey(username);
  const allowUat123456 = isUatOtpModeForForgotPassword(headers);

  try {
    const customer = await findCustomerForPasswordLogin(username);
    await assertVerifyRateAllowed(customer?.id ? String(customer.id) : null, uhash);
    await recordRateEventSafe(`${uhash}:verify`, SCOPE_VERIFY);
    if (customer?.id) {
      await recordRateEventSafe(`cust:${customer.id}:v`, SCOPE_VERIFY);
    }

    if (!customer?.id) {
      await sleepUntilMinDuration(t0);
      return {
        status: 401,
        body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired OTP', requestId).body,
      };
    }

    const dialable = dialablePhoneForCustomerAuth(customer.phone);
    const phoneForOtp = dialable || String(customer.phone || '').trim();
    const ok = await verifyPasswordResetOtp(phoneForOtp, otp, allowUat123456);

    if (!ok) {
      await sleepUntilMinDuration(t0);
      return {
        status: 401,
        body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired OTP', requestId).body,
      };
    }

    const authVersion = await readCustomerAuthVersion(String(customer.id));
    const resetToken = await issuePasswordResetJwt(String(customer.id), authVersion);

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
      const retryAfterSeconds = readRateLimitRetryAfterSeconds(e);
      return buildRateLimitResponse({
        requestId,
        retryAfterSeconds,
        message: RATE_LIMIT_MESSAGE,
        errorBody: envelopeError(429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE, requestId).body,
      });
    }
    console.error(
      '[forgot-password] verify error:',
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

export async function handleCustomerForgotPasswordReset(params: {
  body: unknown;
  requestId: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { body, requestId } = params;
  const parsed = CustomerForgotPasswordResetSchema.safeParse(body);
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

  const tok = await verifyPasswordResetJwt(resetToken);
  if (!tok.ok) {
    return {
      status: 401,
      body: envelopeError(401, 'UNAUTHORIZED', 'Invalid or expired reset link. Request a new code.', requestId).body,
    };
  }

  const row = await selectCustomerIdAndAuthVersion(tok.customerId);
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
  await updateCustomerPasswordHashWithAuthVersionBump(hash, tok.customerId);

  const phoneRow = await query(`SELECT phone FROM customers WHERE id = $1::uuid LIMIT 1`, [tok.customerId]);
  const dbPhone = (phoneRow as any).rows?.[0]?.phone;
  const dialable = dialablePhoneForCustomerAuth(dbPhone);
  const signOut = await adminGlobalSignOutCognitoUserByDialablePhone(dialable);
  if (!signOut.ok) {
    console.warn('[forgot-password] Cognito global sign-out failed (password still updated):', signOut.error);
  }

  return {
    status: 200,
    body: envelopeSuccess({ ok: true }, requestId),
  };
}
