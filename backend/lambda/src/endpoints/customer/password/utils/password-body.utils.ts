import type { Context } from 'hono';

export function pickStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Spread-safe: `undefined` in overlays must not wipe keys from the base (common with JSON.parse + optional fields). */
export function omitUndefinedShallow(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const PASSWORD_BODY_KEYS = ['newPassword', 'new_password', 'password'] as const;

/** Drop empty password fields so a partial `{ newPassword: "" }` cannot mask a valid password in a later merge. */
export function omitEmptyPasswordKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out = { ...o };
  for (const k of PASSWORD_BODY_KEYS) {
    if (k in out && pickStr(out[k]).length === 0) delete out[k];
  }
  return out;
}

export function mergeChangePasswordRequestBody(
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

export function parseBodyFromApiGatewayEvent(c: Context): Record<string, unknown> {
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

export function envParsedBodyRecord(c: Context): Record<string, unknown> {
  const envPb = (c.env as { parsedBody?: unknown } | undefined)?.parsedBody;
  if (envPb && typeof envPb === 'object' && envPb !== null && !Array.isArray(envPb)) {
    return { ...(envPb as Record<string, unknown>) };
  }
  return {};
}

export async function mergeHonoJsonBodyFromRequest(c: Context): Promise<Record<string, unknown>> {
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

export function authHeadersFromCustomerRequest(c: Context): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (auth) headers.authorization = auth;
  const uatM = c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode');
  if (uatM) headers['x-uat-mode'] = uatM;
  return headers;
}
