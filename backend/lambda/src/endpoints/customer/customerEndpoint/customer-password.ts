/**
 * ============================================================================
 * CUSTOMER PASSWORD MANAGEMENT ENDPOINTS
 * ============================================================================
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select } from '../../../database/rds-connection';
import { extractAndVerifyAuthToken } from '../../../utils/jwt-verification';
import {
  hashCustomerPasswordBcrypt,
  verifyCustomerPassword,
} from '../../../lib/services/auth/customer-password-crypto';
import { updateCustomerPasswordHashWithAuthVersionBump } from '../../../lib/services/auth/customer-auth-version-support';

async function selectCustomerIdByPhoneLast10(last10: string): Promise<string | null> {
  const key = last10.replace(/\D/g, '').slice(-10);
  if (!key || key.length < 10) return null;
  const res = await query(
    `SELECT id FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY
       LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) ASC,
       (profile_completed IS TRUE) DESC,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [key]
  );
  const row = (res as any).rows?.[0];
  return row?.id ? String(row.id) : null;
}

/**
 * Map verified customer JWT to Postgres `customers.id`.
 * UAT/app JWTs may use DB UUID as `sub`; Cognito uses pool sub + `phone_number` / `cognito:username`.
 *
 * Customer-web UAT login uses opaque `Bearer uat-token-customer-{10digits}-{timestamp}` (not a JWT).
 * Those must resolve by phone when `X-UAT-Mode: true` or `UAT_MODE=true`.
 */
/** Exported for package/session routes that must verify `package_purchases.customer_id`. */
export async function resolvePostgresCustomerIdFromAuthHeaders(
  headers: Record<string, string | undefined>
): Promise<string | null> {
  const authRaw = headers['authorization'] || headers['Authorization'];
  const auth = typeof authRaw === 'string' ? authRaw : '';
  const uatModeOn =
    String(headers['x-uat-mode'] || headers['X-UAT-Mode'] || '').toLowerCase() === 'true' ||
    process.env.UAT_MODE === 'true';

  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  const opaqueToken = bearerMatch ? bearerMatch[1].trim() : '';

  if (opaqueToken.startsWith('uat-token-customer-') && uatModeOn) {
    const m = opaqueToken.match(/^uat-token-customer-(\d{10,})-\d+$/);
    if (m) {
      const last10 = m[1].replace(/\D/g, '').slice(-10);
      if (last10.length === 10) {
        const byUat = await selectCustomerIdByPhoneLast10(last10);
        if (byUat) return byUat;
      }
    }
  }

  const normalized: Record<string, string> = {};
  if (auth) normalized.authorization = auth;

  const res = await extractAndVerifyAuthToken(normalized);
  if (!res.valid || !res.payload) return null;
  const groups = (res.payload['cognito:groups'] as string[]) || [];
  const ut = res.payload['custom:user_type'];
  if (!groups.includes('customer') && ut !== 'customer') return null;

  const sub = String(res.payload.sub || '');
  if (sub && /^[0-9a-fA-F-]{36}$/.test(sub)) {
    const chk = await query(`SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`, [sub]);
    if ((chk as any).rows?.[0]) return String((chk as any).rows[0].id);
  }

  const phoneClaim = String(res.payload.phone_number || '').trim();
  const digits = phoneClaim.replace(/\D/g, '');
  if (digits.length >= 10) {
    const id = await selectCustomerIdByPhoneLast10(digits.slice(-10));
    if (id) return id;
  }

  const cname = String(res.payload['cognito:username'] || '');
  const m = cname.match(/^phone_(.+)$/);
  if (m) {
    const d2 = m[1].replace(/\D/g, '');
    if (d2.length >= 10) {
      const id2 = await selectCustomerIdByPhoneLast10(d2.slice(-10));
      if (id2) return id2;
    }
  }

  return null;
}

// ============================================================================
// CHANGE PASSWORD HANDLER (legacy /customer/change-password)
// ============================================================================

function pickStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Spread-safe: `undefined` in overlays must not wipe keys from the base (common with JSON.parse + optional fields). */
function omitUndefinedShallow(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const PASSWORD_BODY_KEYS = ['newPassword', 'new_password', 'password'] as const;

/** Drop empty password fields so a partial `{ newPassword: "" }` cannot mask a valid password in a later merge. */
function omitEmptyPasswordKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out = { ...o };
  for (const k of PASSWORD_BODY_KEYS) {
    if (k in out && pickStr(out[k]).length === 0) delete out[k];
  }
  return out;
}

/**
 * Merge API Gateway `parseBody(event)` with Hono-injected `__parsedRequestBody`.
 * Never use `forced` alone: it may contain phone/currentPassword but omit newPassword while event.body has it.
 */
function mergeChangePasswordRequestBody(
  fromEvent: Record<string, unknown>,
  forced?: Record<string, unknown>
): Record<string, unknown> {
  const base = omitEmptyPasswordKeys(omitUndefinedShallow(fromEvent));
  if (!forced || typeof forced !== 'object' || Array.isArray(forced)) return base;
  return {
    ...base,
    ...omitEmptyPasswordKeys(omitUndefinedShallow(forced as Record<string, unknown>)),
  };
}

/** True only for bcrypt or legacy PBKDF2 `salt:hex` — ignores stray non-null DB values so first-time setup can skip current password. */
export function hasMeaningfulStoredPassword(passwordHash: unknown): boolean {
  if (passwordHash == null || typeof passwordHash !== 'string') return false;
  const t = passwordHash.trim();
  if (!t) return false;
  if (t.startsWith('$2a$') || t.startsWith('$2b$') || t.startsWith('$2y$')) {
    return t.length >= 50;
  }
  const parts = t.split(':');
  if (parts.length >= 2 && parts[0].length > 0 && parts.slice(1).join(':').length > 8) {
    return true;
  }
  return false;
}

/** Parsed JSON from the raw API Gateway event (Lambda passes `event` on `c.env`). */
function parseBodyFromApiGatewayEvent(c: Context): Record<string, unknown> {
  const wrap = c.env as Record<string, unknown> | undefined;
  const ev = (wrap?.event ?? wrap?.lambdaEvent) as
    | { body?: string | null; isBase64Encoded?: boolean }
    | undefined;
  const raw = ev?.body;
  if (!raw || typeof raw !== 'string') return {};
  try {
    const str =
      ev.isBase64Encoded === true ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
    const j = JSON.parse(str) as unknown;
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

function envParsedBodyRecord(c: Context): Record<string, unknown> {
  const envPb = (c.env as { parsedBody?: unknown } | undefined)?.parsedBody;
  if (envPb && typeof envPb === 'object' && envPb !== null && !Array.isArray(envPb)) {
    return { ...(envPb as Record<string, unknown>) };
  }
  return {};
}

/**
 * Merge Lambda `event.body` + `parsedBody` + Hono Request body (single read).
 * Prefer API Gateway / `c.env.parsedBody` when they already contain JSON — some runtimes leave the
 * Fetch `Request` body stream empty after the Lambda adapter runs, and `{ ...fromLambda, ...fromReq }`
 * would then wipe fields with an empty `fromReq` (classic symptom: valid password → 400 "8 characters").
 */
async function mergeHonoJsonBodyFromRequest(c: Context): Promise<Record<string, unknown>> {
  const fromLambda = { ...parseBodyFromApiGatewayEvent(c), ...envParsedBodyRecord(c) };

  const passwordLikeFromLambda =
    pickStr(fromLambda.newPassword) ||
    pickStr(fromLambda.new_password) ||
    pickStr(fromLambda.password);

  if (passwordLikeFromLambda.length > 0) {
    return fromLambda;
  }

  let fromReq: Record<string, unknown> = {};
  try {
    const raw = await c.req.text();
    const t = (raw ?? '').trim();
    if (t.startsWith('{')) {
      const j = JSON.parse(t) as unknown;
      if (j && typeof j === 'object' && !Array.isArray(j)) {
        fromReq = j as Record<string, unknown>;
      }
    }
  } catch {
    fromReq = {};
  }

  const hasReqKeys = Object.keys(fromReq).length > 0;
  if (!hasReqKeys) return fromLambda;
  return { ...fromLambda, ...fromReq };
}

class ChangePasswordHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const forced = (context.event as { __parsedRequestBody?: Record<string, unknown> }).__parsedRequestBody;
    const fromEvent = this.parseBody(context.event) as Record<string, unknown>;
    const body = mergeChangePasswordRequestBody(fromEvent, forced);
    const currentPassword =
      pickStr(body.currentPassword) || pickStr(body.current_password);
    const newPassword =
      pickStr(body.newPassword) ||
      pickStr(body.new_password) ||
      pickStr(body.password) ||
      pickStr(fromEvent.newPassword) ||
      pickStr(fromEvent.new_password) ||
      pickStr(fromEvent.password);
    const customerId = body.customerId ?? body.customer_id;
    const phone = pickStr(body.phone) || pickStr(body.phone_number);

    if (!newPassword || newPassword.length < 8) {
      return this.error('New password must be at least 8 characters long', 400);
    }

    try {
      let customerIdResolved: string | undefined =
        typeof customerId === 'string' && customerId.trim() ? String(customerId).trim() : undefined;
      if (!customerIdResolved && phone) {
        const customers = await select('customers', { phone });
        if (customers.length === 0) {
          const last10 = phone.replace(/\D/g, '').slice(-10);
          if (last10.length >= 10) {
            const byLast10 = await selectCustomerIdByPhoneLast10(last10);
            if (byLast10) customerIdResolved = byLast10;
          }
        } else {
          customerIdResolved = customers[0].id;
        }
      }

      if (!customerIdResolved) {
        const headers = this.getHeaders(context.event);
        const fromAuth = await resolvePostgresCustomerIdFromAuthHeaders(headers);
        if (fromAuth) customerIdResolved = fromAuth;
      }

      if (!customerIdResolved) {
        return this.error('Customer ID or phone is required', 400);
      }

      const customers = await query(
        `SELECT id, password_hash, phone FROM customers WHERE id = $1::uuid OR phone = $1::text`,
        [customerIdResolved]
      );

      if (customers.rows.length === 0) {
        return this.error('Customer not found', 404);
      }

      const customer = customers.rows[0];

      if (hasMeaningfulStoredPassword(customer.password_hash)) {
        if (!currentPassword || !String(currentPassword).trim()) {
          return this.error('Current password is required', 400);
        }
        const isValid = await verifyCustomerPassword(currentPassword, customer.password_hash);
        if (!isValid) {
          return this.error('Current password is incorrect', 401);
        }
      }

      const newPasswordHash = await hashCustomerPasswordBcrypt(newPassword);

      await updateCustomerPasswordHashWithAuthVersionBump(newPasswordHash, customer.id);

      return this.success({
        message: 'Password changed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      return this.error(error.message || 'Failed to change password', 500);
    }
  }
}

function authHeadersFromCustomerRequest(c: Context): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (auth) headers.authorization = auth;
  const uatM = c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode');
  if (uatM) headers['x-uat-mode'] = uatM;
  return headers;
}

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

  return c.json({
    success: true,
    data: { ok: true },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerCustomerPasswordEndpoints(app: Hono) {
  const changePasswordHandler = new ChangePasswordHandler();

  // Shallow aliases (before /customer/:customerId): some API Gateway setups only expose legacy
  // /customer/change-password; deep paths like /customer/profile/set-password may 404 until redeployed.
  app.get('/customer/password-status', handleCustomerAccountStatus);
  app.post('/customer/set-password', handleCustomerSetPassword);

  // Profile + account password literals live on registerCustomerProfileEndpoints (first routes there)
  // so they always precede GET /customer/profile/:identifier. This module keeps legacy change-password only.

  app.post('/customer/change-password', async (c) => {
    const envPb = (c.env as { parsedBody?: Record<string, unknown> | null } | undefined)?.parsedBody;
    const fromGateway =
      envPb && typeof envPb === 'object' && !Array.isArray(envPb) ? { ...envPb } : {};
    const merged = await mergeHonoJsonBodyFromRequest(c);
    // Gateway first, Hono merge last so stream/Lambda merge wins; omit `undefined` so partial parses
    // cannot wipe `newPassword` via `{ ...merged, ...fromGateway }` (previous bug).
    const parsed = {
      ...omitEmptyPasswordKeys(omitUndefinedShallow(fromGateway)),
      ...omitEmptyPasswordKeys(omitUndefinedShallow(merged)),
    };
    const event = createApiGatewayEventFromParsedBody(c.req, parsed);
    (event as { __parsedRequestBody?: Record<string, unknown> }).__parsedRequestBody = parsed;
    const context = createLambdaContext();
    const result = await changePasswordHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

/** Build a minimal API Gateway-shaped event for BaseHandler.parseBody (Hono Request has no `.body` object). */
function createApiGatewayEventFromParsedBody(req: Context['req'], parsed: Record<string, unknown>): any {
  const headers: Record<string, string> = {};
  req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    pathParameters: {},
    queryStringParameters: {},
    body: JSON.stringify(parsed ?? {}),
    isBase64Encoded: false,
    headers,
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header('x-user-id') || 'test-user',
        },
      },
    },
  };
}

function createLambdaContext(): any {
  return {};
}
