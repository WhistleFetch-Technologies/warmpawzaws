/**
 * Pidge store-channel integration: vendor login and Bearer token cache.
 * Upstream: POST {base}/v1.0/store/channel/vendor/login  body: { username, password }
 */

import { select } from '../../database/rds-connection';
import { getSecretJson } from '../../utils/aws/secrets-manager';

const PIDGE_VENDOR_LOGIN_PATH = '/v1.0/store/channel/vendor/login';
const PIDGE_CREATE_ORDER_PATH = '/v1.0/store/channel/vendor/order';
/** GET /v1.0/store/channel/vendor/order/:id — :id is the Pidge id from create-order response. */
const PIDGE_ORDER_BY_ID_PREFIX = '/v1.0/store/channel/vendor/order';
/** POST /v1.0/store/channel/vendor/:id/cancel — only when order Status is PENDING or FULFILLED. */
const PIDGE_VENDOR_PREFIX = '/v1.0/store/channel/vendor';

/** Override with PIDGE_API_BASE env if Pidge gives you a different host (no trailing slash). */
const DEFAULT_PIDGE_API_BASE =
  (process.env.PIDGE_API_BASE || 'https://api.pidge.in').replace(/\/$/, '');

let cachedToken: string | null = null;
let cachedExpiryMs = 0;

export function clearPidgeTokenCache(): void {
  cachedToken = null;
  cachedExpiryMs = 0;
}

export function resolvePidgeBaseUrl(url?: string | null): string {
  const u = (url || DEFAULT_PIDGE_API_BASE).replace(/\/$/, '');
  return u || DEFAULT_PIDGE_API_BASE;
}

export interface PidgeCredentials {
  username: string;
  password: string;
  baseUrl: string;
}

/**
 * Resolve credentials: Secrets Manager "pidge" → platform_settings → enabled logistics_partners row (partner_type pidge).
 * DB row: email = username, api_key = password (admin UI), base_url = API host.
 */
export async function getPidgeCredentials(): Promise<PidgeCredentials> {
  try {
    const sm = await getSecretJson<{
      username?: string;
      password?: string;
      base_url?: string;
      baseUrl?: string;
    }>('pidge');
    if (sm?.username && sm?.password) {
      return {
        username: sm.username,
        password: sm.password,
        baseUrl: resolvePidgeBaseUrl(sm.base_url || sm.baseUrl),
      };
    }
  } catch {
    // fall through
  }

  const settings = await select('platform_settings', {
    setting_key: 'platform:integrations:pidge',
  });
  if (settings.length > 0) {
    const v = settings[0].setting_value as {
      username?: string;
      password?: string;
      base_url?: string;
      baseUrl?: string;
    };
    if (v?.username && v?.password) {
      return {
        username: v.username,
        password: v.password,
        baseUrl: resolvePidgeBaseUrl(v.base_url || v.baseUrl),
      };
    }
  }

  const rows = await select('logistics_partners', { partner_type: 'pidge', enabled: true });
  const row = rows[0] as
    | {
        email?: string | null;
        api_key?: string | null;
        password?: string | null;
        base_url?: string | null;
        config?: { pidgeApiBase?: string };
      }
    | undefined;

  if (!row) {
    throw new Error(
      'Pidge credentials not configured. Set Secrets Manager "pidge", platform:integrations:pidge, or enable a pidge logistics_partners row with username (email) and password (api_key).'
    );
  }

  const username = (row.email || '').trim();
  const password = (row.api_key || row.password || '').trim();
  if (!username || !password) {
    throw new Error(
      'Pidge partner row is missing username (API Username / email column) or password (API Key column).'
    );
  }

  const cfgBase =
    row.config && typeof row.config === 'object' && 'pidgeApiBase' in row.config
      ? String((row.config as { pidgeApiBase?: string }).pidgeApiBase || '')
      : '';
  const baseUrl = resolvePidgeBaseUrl(row.base_url || cfgBase || undefined);

  return { username, password, baseUrl };
}

/**
 * Call Pidge vendor login; returns Bearer token string.
 */
export async function fetchPidgeVendorToken(
  username: string,
  password: string,
  baseUrl: string
): Promise<string> {
  const root = resolvePidgeBaseUrl(baseUrl);
  const url = `${root}${PIDGE_VENDOR_LOGIN_PATH}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Pidge login returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(
      `Pidge vendor login failed (${response.status}): ${text.slice(0, 300)}`
    );
  }

  const inner = data.data as Record<string, unknown> | undefined;
  const token =
    (typeof inner?.token === 'string' && inner.token) ||
    (typeof data.token === 'string' && data.token) ||
    (typeof (data as { access_token?: string }).access_token === 'string' &&
      (data as { access_token: string }).access_token) ||
    '';

  if (!token) {
    throw new Error(
      'Pidge login succeeded but no token in response (password revoked or schema changed).'
    );
  }

  return token;
}

/**
 * Cached token for server-side outbound Pidge calls (refresh on 401 by calling clearPidgeTokenCache()).
 */
export async function getPidgeToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedExpiryMs) {
    return cachedToken;
  }
  const { username, password, baseUrl } = await getPidgeCredentials();
  const token = await fetchPidgeVendorToken(username, password, baseUrl);
  cachedToken = token;
  cachedExpiryMs = Date.now() + 23 * 60 * 60 * 1000;
  return token;
}

// ---------------------------------------------------------------------------
// Create order — POST /v1.0/store/channel/vendor/order
// Response data: { [source_order_id]: pidge_id } (pidge id = :id elsewhere)
// ---------------------------------------------------------------------------

export interface PidgeBrandBlock {
  code: string;
  location_code: string;
  name: string;
}

export interface PidgeIntegrationOrderDefaults {
  brand: PidgeBrandBlock;
  channel: string;
  default_country: string;
}

/** Brand/channel defaults: partner row config → env → placeholders (Pidge may reject if unset). */
export async function getPidgeOrderDefaults(): Promise<PidgeIntegrationOrderDefaults> {
  const rows = await select('logistics_partners', { partner_type: 'pidge', enabled: true });
  const cfg = (rows[0]?.config || {}) as {
    brand?: Partial<PidgeBrandBlock>;
    channel?: string;
    default_country?: string;
    brandCode?: string;
    brandLocationCode?: string;
    brandName?: string;
  };

  const brand: PidgeBrandBlock = {
    code:
      cfg.brand?.code ||
      cfg.brandCode ||
      process.env.PIDGE_BRAND_CODE ||
      '',
    location_code:
      cfg.brand?.location_code ||
      cfg.brandLocationCode ||
      process.env.PIDGE_LOCATION_CODE ||
      '',
    name:
      cfg.brand?.name ||
      cfg.brandName ||
      process.env.PIDGE_BRAND_NAME ||
      'WarmPawz',
  };

  const channel =
    cfg.channel || process.env.PIDGE_CHANNEL || 'warmpawz';

  const default_country =
    cfg.default_country || process.env.PIDGE_DEFAULT_COUNTRY || 'India';

  return { brand, channel, default_country };
}

function toPidgeAddress(
  a: Record<string, unknown> | undefined,
  fallbackCountry: string
): Record<string, unknown> {
  if (!a || typeof a !== 'object') {
    return {
      address_line_1: '',
      city: '',
      state: '',
      country: fallbackCountry,
      pincode: '',
    };
  }
  const line1 =
    (a.address_line_1 as string) ||
    (a.street as string) ||
    (a.line1 as string) ||
    (a.address as string) ||
    '';
  const line2 =
    (a.address_line_2 as string) ||
    (a.line2 as string) ||
    '';
  return {
    address_line_1: line1,
    address_line_2: line2 || undefined,
    label: (a.label as string) || undefined,
    landmark: (a.landmark as string) || undefined,
    city: String(a.city || ''),
    state: String(a.state || ''),
    country: String(a.country || fallbackCountry),
    pincode: String(a.pincode || a.zip || ''),
    latitude:
      typeof a.latitude === 'number'
        ? a.latitude
        : typeof a.lat === 'number'
          ? a.lat
          : undefined,
    longitude:
      typeof a.longitude === 'number'
        ? a.longitude
        : typeof a.lng === 'number'
          ? a.lng
          : undefined,
    instructions_to_reach: (a.instructions_to_reach as string) || undefined,
  };
}

function toReceiverSenderDetail(
  block: Record<string, unknown> | undefined,
  fallbackCountry: string
): Record<string, unknown> {
  const addr = toPidgeAddress(
    (block?.address as Record<string, unknown>) || block,
    fallbackCountry
  );
  return {
    address: addr,
    name: String(block?.name || ''),
    mobile: String(block?.mobile || block?.phone || ''),
    email: String(block?.email || ''),
  };
}

/**
 * Build a Pidge create-order body from a compact Warmpawz-style payload.
 * For full control, POST the exact Pidge JSON (brand + channel + sender_detail + poc_detail + trips) instead.
 */
export function buildPidgeOrderPayloadFromSimplified(
  input: Record<string, unknown>,
  defaults: PidgeIntegrationOrderDefaults
): Record<string, unknown> {
  const sourceOrderId = String(
    input.sourceOrderId || input.source_order_id || input.orderId || ''
  ).trim();
  if (!sourceOrderId) {
    throw new Error('sourceOrderId or orderId is required');
  }

  const senderRaw = (input.sender as Record<string, unknown>) ||
    (input.pickup as Record<string, unknown>) ||
    (input.senderDetail as Record<string, unknown>) ||
    {};
  const receiverRaw = (input.receiver as Record<string, unknown>) ||
    (input.delivery as Record<string, unknown>) ||
    (input.receiverDetail as Record<string, unknown>) ||
    {};

  const sender_detail = toReceiverSenderDetail(senderRaw, defaults.default_country);
  const receiver_detail = toReceiverSenderDetail(receiverRaw, defaults.default_country);

  const pocRaw = (input.poc as Record<string, unknown>) ||
    (input.poc_detail as Record<string, unknown>) ||
    senderRaw;
  const poc_detail = {
    name: String(pocRaw.name || senderRaw.name || ''),
    mobile: String(pocRaw.mobile || pocRaw.phone || senderRaw.mobile || senderRaw.phone || ''),
    email: String(pocRaw.email || senderRaw.email || ''),
  };

  const items = Array.isArray(input.items) ? input.items : [];
  const products = items.map((it: unknown) => {
    const row = (it || {}) as Record<string, unknown>;
    const qty = Number(row.quantity ?? row.units ?? 1) || 1;
    const price = Number(row.price ?? row.selling_price ?? row.unit_price ?? 0);
    const weightKeys = ['dead_weight', 'weight_g', 'packWeightGrams', 'pack_weight_grams', 'weightGrams'] as const;
    let deadWeight = 100;
    for (const k of weightKeys) {
      const v = Number(row[k]);
      if (Number.isFinite(v) && v > 0) {
        deadWeight = v;
        break;
      }
    }
    const dim = row.dimension as { dead_weight?: number } | undefined;
    if (dim && Number.isFinite(Number(dim.dead_weight)) && Number(dim.dead_weight) > 0) {
      deadWeight = Number(dim.dead_weight);
    }
    return {
      name: String(row.name || row.product_name || 'Item'),
      sku: String(row.sku || row.product_id || row.productId || ''),
      price,
      quantity: qty,
      dimension: {
        dead_weight: deadWeight,
      },
      image_url: row.image_url ? String(row.image_url) : undefined,
    };
  });

  const billAmount = Number(
    input.billAmount ?? input.bill_amount ?? input.subTotal ?? input.orderValue ?? 0
  );
  const codAmount = Number(input.codAmount ?? input.cod_amount ?? 0);

  const packagesFromItems =
    products.length > 0
      ? products.map((p: { name: string; sku: string; quantity: number; dimension: { dead_weight: number } }) => {
          const grams = Math.max(1, Math.round(p.dimension.dead_weight));
          return {
            label: p.name,
            quantity: p.quantity,
            code: p.sku || undefined,
            dead_weight: grams,
            volumetric_weight: grams,
            length: 2,
            breadth: 2,
            height: 2,
          };
        })
      : (() => {
          const weightKeys = ['packageWeightGrams', 'totalWeightGrams', 'weight_g', 'pack_weight_grams'] as const;
          let fallback = 500;
          for (const k of weightKeys) {
            const v = Number(input[k]);
            if (Number.isFinite(v) && v > 0) {
              fallback = v;
              break;
            }
          }
          const grams = Math.max(1, Math.round(fallback));
          return [
            {
              label: 'Order',
              quantity: 1,
              dead_weight: grams,
              volumetric_weight: grams,
              length: 2,
              breadth: 2,
              height: 2,
            },
          ];
        })();

  const notes = Array.isArray(input.notes) ? input.notes : [];

  const trip: Record<string, unknown> = {
    receiver_detail,
    packages: packagesFromItems,
    source_order_id: sourceOrderId,
    reference_id: String(input.referenceId || input.reference_id || sourceOrderId),
    cod_amount: codAmount,
    bill_amount: billAmount,
    products,
    notes,
  };

  if (input.promised_prep_time || input.promisedPrepTime) {
    trip.promised_prep_time = String(input.promised_prep_time || input.promisedPrepTime);
  }
  if (input.promised_delivery_time || input.promisedDeliveryTime) {
    trip.promised_delivery_time = String(
      input.promised_delivery_time || input.promisedDeliveryTime
    );
  }
  if (input.delivery_date || input.deliveryDate) {
    trip.delivery_date = String(input.delivery_date || input.deliveryDate);
  }
  if (input.delivery_slot || input.deliverySlot) {
    trip.delivery_slot = String(input.delivery_slot || input.deliverySlot);
  }

  const brand =
    input.brand && typeof input.brand === 'object'
      ? {
          code: String((input.brand as PidgeBrandBlock).code || defaults.brand.code),
          location_code: String(
            (input.brand as PidgeBrandBlock).location_code || defaults.brand.location_code
          ),
          name: String((input.brand as PidgeBrandBlock).name || defaults.brand.name),
        }
      : defaults.brand;

  const channel = String(input.channel || defaults.channel);

  return {
    brand,
    channel,
    sender_detail,
    poc_detail,
    trips: [trip],
  };
}

/**
 * Returns true if body looks like a native Pidge create-order payload.
 */
export function isPidgeNativeCreateOrderBody(body: Record<string, unknown>): boolean {
  return (
    body.brand != null &&
    typeof body.brand === 'object' &&
    Array.isArray(body.trips) &&
    body.trips.length > 0
  );
}

/**
 * POST create order. Retries once on 401 after clearing token cache.
 * @returns Parsed JSON from Pidge (shape includes data: Record<source_order_id, pidge_id>).
 */
export async function pidgeCreateOrder(
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; rawText: string }> {
  const { baseUrl } = await getPidgeCredentials();
  const root = resolvePidgeBaseUrl(baseUrl);
  const url = `${root}${PIDGE_CREATE_ORDER_PATH}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let token = await getPidgeToken();
  let response = await doFetch(token);

  if (response.status === 401) {
    clearPidgeTokenCache();
    token = await getPidgeToken();
    response = await doFetch(token);
  }

  const rawText = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `Pidge create order returned non-JSON (${response.status}): ${rawText.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Pidge create order failed (${response.status}): ${rawText.slice(0, 500)}`
    );
  }

  return { ok: true, status: response.status, json, rawText };
}

/**
 * GET order status — /v1.0/store/channel/vendor/order/:id
 * Returns order payload plus fulfillment (status, logs, rider, locations). Retries once on 401.
 */
export async function pidgeGetOrderStatus(
  pidgeOrderId: string
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; rawText: string }> {
  const id = String(pidgeOrderId || '').trim();
  if (!id) {
    throw new Error('Pidge order id is required');
  }

  const { baseUrl } = await getPidgeCredentials();
  const root = resolvePidgeBaseUrl(baseUrl);
  const url = `${root}${PIDGE_ORDER_BY_ID_PREFIX}/${encodeURIComponent(id)}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getPidgeToken();
  let response = await doFetch(token);

  if (response.status === 401) {
    clearPidgeTokenCache();
    token = await getPidgeToken();
    response = await doFetch(token);
  }

  const rawText = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `Pidge get order returned non-JSON (${response.status}): ${rawText.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    const err = new Error(
      `Pidge get order failed (${response.status}): ${rawText.slice(0, 500)}`
    ) as Error & { httpStatus?: number };
    err.httpStatus = response.status;
    throw err;
  }

  return { ok: true, status: response.status, json, rawText };
}

/**
 * POST cancel order — /v1.0/store/channel/vendor/:id/cancel
 * Allowed only when status is PENDING or FULFILLED; cancellation is terminal for processing.
 */
export async function pidgeCancelOrder(
  pidgeOrderId: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; rawText: string }> {
  const id = String(pidgeOrderId || '').trim();
  if (!id) {
    throw new Error('Pidge order id is required');
  }

  const { baseUrl } = await getPidgeCredentials();
  const root = resolvePidgeBaseUrl(baseUrl);
  const url = `${root}${PIDGE_VENDOR_PREFIX}/${encodeURIComponent(id)}/cancel`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body && Object.keys(body).length > 0 ? body : {}),
    });

  let token = await getPidgeToken();
  let response = await doFetch(token);

  if (response.status === 401) {
    clearPidgeTokenCache();
    token = await getPidgeToken();
    response = await doFetch(token);
  }

  const rawText = await response.text();
  let json: Record<string, unknown> = {};
  if (rawText.trim()) {
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new Error(
          `Pidge cancel order returned non-JSON (${response.status}): ${rawText.slice(0, 300)}`
        );
      }
      json = { _raw: rawText.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const err = new Error(
      `Pidge cancel order failed (${response.status}): ${rawText.slice(0, 500)}`
    ) as Error & { httpStatus?: number };
    err.httpStatus = response.status;
    throw err;
  }

  return { ok: true, status: response.status, json, rawText };
}

/** Extract { source_order_id -> pidge_id } map from create-order response. */
export function extractPidgeOrderIdMap(
  json: Record<string, unknown>
): Record<string, string> {
  let data = json.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      data = undefined;
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
  return {};
}
