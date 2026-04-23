/**
 * Vendor password setup (authenticated) — mirrors customer /auth/customer/set-password
 * and shallow /customer/profile/set-password style paths (see registerVendorProfilePasswordLiterals).
 */

import type { Context, Hono } from 'hono';
import { extractAndVerifyAuthToken } from '../../utils/jwt-verification';
import { query } from '../../database/rds-connection';
import { hashCustomerPasswordBcrypt } from '../../lib/services/auth/customer-password-crypto';
import { updateVendorPasswordHashWithAuthVersionBump } from '../../lib/services/auth/vendor-auth-version-support';
import {
  findVendorForPasswordLogin,
  findVendorIdViaVendorIdentityByPhone,
  mergeVendorIdentityOnboarding,
} from '../../lib/services/auth/vendor-username-lookup';
import { dialablePhoneForCustomerAuth, normalizePhoneForOtp } from '../../lib/services/auth/customer-username-lookup';
import { hasMeaningfulStoredPassword } from '../customer/customerEndpoint/customer-password';
import { VendorSetPasswordRequestSchema } from '@warmpawz/api-contracts/auth';

const PROFILE_INCOMPLETE_STATUSES = new Set(['INIT', 'ROLE_PENDING', 'FORM_PENDING']);

/** `temp_vendor_${phone}_${Date.now()}` — recover phone when JWT claims omit it. */
function phoneFromTempVendorSub(sub: string): string | null {
  const prefix = 'temp_vendor_';
  if (!sub.startsWith(prefix)) return null;
  const rest = sub.slice(prefix.length);
  const u = rest.lastIndexOf('_');
  if (u <= 0) return null;
  const maybeTs = rest.slice(u + 1);
  if (!/^\d{10,}$/.test(maybeTs)) return null;
  return rest.slice(0, u) || null;
}

function pickStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Phone strings to try for vendors / vendor_identity (claim shapes and DB shapes differ). */
function vendorPhoneLookupCandidates(payload: {
  sub?: string;
  phone_number?: string;
  'cognito:username'?: string;
}): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = String(s || '').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  const raw = String(payload.phone_number || payload['cognito:username'] || '').trim();
  if (raw) {
    add(raw);
    add(dialablePhoneForCustomerAuth(raw));
    add(normalizePhoneForOtp(raw));
  }
  const sub = String(payload.sub || '').trim();
  if (sub.startsWith('temp_vendor_')) {
    const embedded = phoneFromTempVendorSub(sub);
    if (embedded) {
      add(embedded);
      add(dialablePhoneForCustomerAuth(embedded));
      add(normalizePhoneForOtp(embedded));
    }
  }
  return out;
}

function cognitoGroupsAsArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string' && raw) return [raw];
  return [];
}

function authHeadersFromVendorRequest(c: Context): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (auth) headers.authorization = auth;
  const uatM = c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode');
  if (uatM) headers['x-uat-mode'] = uatM;
  return headers;
}

function envParsedBodyRecord(c: Context): Record<string, unknown> {
  const envPb = (c.env as { parsedBody?: unknown } | undefined)?.parsedBody;
  if (envPb && typeof envPb === 'object' && envPb !== null && !Array.isArray(envPb)) {
    return { ...(envPb as Record<string, unknown>) };
  }
  return {};
}

function parseBodyFromApiGatewayEvent(c: Context): Record<string, unknown> {
  const wrap = c.env as Record<string, unknown> | undefined;
  const ev = (wrap?.event ?? wrap?.lambdaEvent) as
    | { body?: string | null; isBase64Encoded?: boolean }
    | undefined;
  const raw = ev?.body;
  if (!raw || typeof raw !== 'string') return {};
  try {
    const str = ev.isBase64Encoded === true ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
    const j = JSON.parse(str) as unknown;
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

async function mergeHonoJsonBodyFromRequest(c: Context): Promise<Record<string, unknown>> {
  const fromLambda = { ...parseBodyFromApiGatewayEvent(c), ...envParsedBodyRecord(c) };
  const pwdLike =
    pickStr(fromLambda.password) ||
    pickStr(fromLambda.newPassword) ||
    pickStr(fromLambda.new_password);
  if (pwdLike.length > 0) return fromLambda;

  let fromReq: Record<string, unknown> = {};
  try {
    const raw = await c.req.text();
    const t = (raw ?? '').trim();
    if (t.startsWith('{')) {
      const j = JSON.parse(t) as unknown;
      if (j && typeof j === 'object' && !Array.isArray(j)) fromReq = j as Record<string, unknown>;
    }
  } catch {
    fromReq = {};
  }
  return Object.keys(fromReq).length > 0 ? { ...fromLambda, ...fromReq } : fromLambda;
}

/**
 * Resolve `vendors.id` for vendor-only JWT / identity / temp flows.
 */
export async function resolveVendorsTableIdFromAuthHeaders(
  headers: Record<string, string | undefined>
): Promise<string | null> {
  const authRaw = headers['authorization'] || headers['Authorization'];
  const auth = typeof authRaw === 'string' ? authRaw : '';
  const normalized: Record<string, string> = {};
  if (auth) normalized.authorization = auth;

  const res = await extractAndVerifyAuthToken(normalized);
  if (!res.valid || !res.payload) {
    console.warn(`[vendor-password] JWT/auth failed before vendor lookup: ${res.error || 'unknown'}`);
    return null;
  }
  const p = res.payload;
  const groups = cognitoGroupsAsArray(p['cognito:groups']);
  const ut = p['custom:user_type'];
  if (!groups.includes('vendor') && ut !== 'vendor') {
    console.warn(`[vendor-password] Token verified but role is not vendor (custom:user_type=${String(ut)})`);
    return null;
  }

  const sub = String(p.sub || '').trim();
  let phoneCandidates = vendorPhoneLookupCandidates(p);

  if (sub && /^[0-9a-fA-F-]{36}$/.test(sub)) {
    const vRow = await query(`SELECT id FROM vendors WHERE id = $1::uuid LIMIT 1`, [sub]);
    if ((vRow as any).rows?.[0]) return String((vRow as any).rows[0].id);

    const idRow = await query(
      `SELECT vendor_id, phone FROM vendor_identity WHERE id = $1::uuid AND (is_deleted IS NULL OR is_deleted = false) LIMIT 1`,
      [sub]
    );
    const id0 = (idRow as any).rows?.[0];
    if (id0?.vendor_id) return String(id0.vendor_id);
    if (id0?.phone) {
      const fromVi = String(id0.phone).trim();
      const extra = [fromVi, dialablePhoneForCustomerAuth(fromVi), normalizePhoneForOtp(fromVi)].filter(
        (x) => String(x || '').trim().length > 0
      ) as string[];
      phoneCandidates = [...new Set([...extra, ...phoneCandidates])];
    }
  }

  const seen = new Set<string>();
  for (const c of phoneCandidates) {
    const k = c.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const v = await findVendorForPasswordLogin(k);
    if (v?.id) return String(v.id);
    const viaIdentity = await findVendorIdViaVendorIdentityByPhone(k);
    if (viaIdentity) return viaIdentity;
  }

  const subKind =
    !sub ? 'empty' : sub.startsWith('temp_vendor_') ? 'temp_vendor' : /^[0-9a-fA-F-]{36}$/.test(sub) ? 'uuid' : 'other';
  const phoneFromClaims = String(p.phone_number || p['cognito:username'] || '').trim();
  console.warn(
    `[vendor-password] JWT verified for vendor role but no vendors row matched (sub_kind=${subKind}, has_phone_claim=${Boolean(phoneFromClaims)}, candidates_tried=${seen.size})`
  );
  return null;
}

async function loadVendorRowForPasswordGate(vendorId: string): Promise<any | null> {
  const r = await query(`SELECT * FROM vendors WHERE id = $1::uuid LIMIT 1`, [vendorId]);
  const row = (r as any).rows?.[0];
  if (!row) return null;
  return mergeVendorIdentityOnboarding(row);
}

export async function handleVendorPasswordStatus(c: Context) {
  const vendorId = await resolveVendorsTableIdFromAuthHeaders(authHeadersFromVendorRequest(c));
  if (!vendorId) {
    return c.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }, meta: { version: 'v1' } },
      401
    );
  }

  const merged = await loadVendorRowForPasswordGate(vendorId);
  if (!merged) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404);
  }

  const onboarding = String(merged.onboarding_status || 'INIT').toUpperCase();
  const profileComplete = !PROFILE_INCOMPLETE_STATUSES.has(onboarding);
  const hasPwd = hasMeaningfulStoredPassword(merged.password_hash);
  const needs_password_setup = profileComplete && !hasPwd;

  return c.json({
    success: true,
    data: {
      vendor_id: merged.id,
      has_password: hasPwd,
      onboarding_status: onboarding,
      needs_password_setup,
    },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

export async function handleVendorSetPassword(c: Context) {
  const vendorId = await resolveVendorsTableIdFromAuthHeaders(authHeadersFromVendorRequest(c));
  if (!vendorId) {
    return c.json(
      { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }, meta: { version: 'v1' } },
      401
    );
  }

  const bodyRaw = await mergeHonoJsonBodyFromRequest(c);
  const parsed = VendorSetPasswordRequestSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        meta: { version: 'v1' },
      },
      400
    );
  }
  const { password, confirmPassword } = parsed.data;

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

  const merged = await loadVendorRowForPasswordGate(vendorId);
  if (!merged) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404);
  }

  const onboarding = String(merged.onboarding_status || 'INIT').toUpperCase();
  if (PROFILE_INCOMPLETE_STATUSES.has(onboarding)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PROFILE_INCOMPLETE',
          message: 'Complete your vendor profile before setting a password.',
        },
        meta: { version: 'v1' },
      },
      403
    );
  }

  if (hasMeaningfulStoredPassword(merged.password_hash)) {
    return c.json(
      {
        success: false,
        error: { code: 'PASSWORD_ALREADY_SET', message: 'Password is already set for this account.' },
        meta: { version: 'v1' },
      },
      400
    );
  }

  const hash = await hashCustomerPasswordBcrypt(password);
  await updateVendorPasswordHashWithAuthVersionBump(hash, vendorId);

  return c.json({
    success: true,
    data: { ok: true },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  });
}

/**
 * Literal routes under /vendor/profile/* so clients are not blocked if only older /auth/* mappings exist.
 * Must register before /vendor/:vendorId routes that could treat "profile" as a path param.
 */
export function registerVendorProfilePasswordLiterals(app: Hono) {
  app.get('/vendor/profile/password-status', handleVendorPasswordStatus);
  app.post('/vendor/profile/set-password', handleVendorSetPassword);
}
