/**
 * Resolve and persist the customer's database UUID for API routes like
 * GET/POST /customer/:customerId/wishlist (Postgres uuid columns).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_KEYS = ['customerId', 'customer_id', 'warmpawz_customer_id'] as const;

declare global {
  interface Window {
    __warmpawz_customer_id_reconciled?: boolean;
  }
}

export function isCustomerDatabaseUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function trimStr(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/** UUID from unified profile / customer object shapes. */
/**
 * Remove non-UUID values from customer id keys (local + session).
 * Does not remove auth token, phone, or full customerData — only the three id keys.
 */
export function clearInvalidCustomerIdKeys(): void {
  if (typeof window === 'undefined') return;
  for (const k of STORAGE_KEYS) {
    const lv = localStorage.getItem(k);
    if (lv != null && lv.trim() !== '' && !isCustomerDatabaseUuid(lv)) {
      localStorage.removeItem(k);
    }
    const sv = sessionStorage.getItem(k);
    if (sv != null && sv.trim() !== '' && !isCustomerDatabaseUuid(sv)) {
      sessionStorage.removeItem(k);
    }
  }
}

/**
 * On load / first API use: strip bad ids, then repopulate keys from `customerData` when it holds a valid UUID.
 * Safe for valid sessions (no-op when keys and profile already match UUID rules).
 */
export function reconcileCustomerIdStorageOnLoad(): void {
  if (typeof window === 'undefined') return;
  clearInvalidCustomerIdKeys();
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw?.trim()) return;
    const d = JSON.parse(raw) as Record<string, unknown>;
    const uuid = extractCustomerUuidFromProfile(d);
    if (uuid) persistCustomerDatabaseId(uuid);
  } catch {
    /* ignore */
  }
}

/** Run reconciliation at most once per full page load (module reload). */
export function ensureCustomerIdStorageReconciledOnce(): void {
  if (typeof window === 'undefined') return;
  if (window.__warmpawz_customer_id_reconciled) return;
  window.__warmpawz_customer_id_reconciled = true;
  reconcileCustomerIdStorageOnLoad();
}

/**
 * Paths where the first segment after `/customer/` must be a DB customer UUID (not phone).
 * Excludes `addresses`: the backend resolves `/customer/:customerId/addresses` by UUID or phone.
 * Excludes `pets`: nested routes like `/customer/:customerId/pets/:petId` accept UUID or phone
 * (see backend pets endpoints); the client must not block phone-based pet URLs.
 * Returns null if this path does not require UUID validation.
 */
export function customerUuidSegmentInPath(path: string): string | null {
  const p = path.replace(/^\/+/, '/');
  const m = p.match(
    /^\/customer\/([^/?#]+)\/(wishlist|returns|rewards|loyalty|profile|bookings|preferences|search-history)(?:\/|$|\?)/
  );
  if (m) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  const sub = p.match(/^\/subscriptions\/customer\/([^/?#]+)(?:\/|$|\?)/);
  if (sub) {
    try {
      return decodeURIComponent(sub[1]).trim();
    } catch {
      return sub[1].trim();
    }
  }
  const ins = p.match(/^\/insurance\/policies\/customer\/([^/?#]+)(?:\/|$|\?)/);
  if (ins) {
    try {
      return decodeURIComponent(ins[1]).trim();
    } catch {
      return ins[1].trim();
    }
  }
  return null;
}

export function extractCustomerUuidFromProfile(
  d: Record<string, unknown> | null | undefined
): string | null {
  if (!d || typeof d !== 'object') return null;
  const candidates = [d.id, d.customer_id, d.customerId];
  for (const c of candidates) {
    const s = trimStr(c);
    if (s && isCustomerDatabaseUuid(s)) return s;
  }
  return null;
}

/**
 * Persist DB customer UUID to all keys the app reads. Merges `id` into `customerData` JSON
 * so getResolvedCustomerId and legacy screens stay consistent.
 */
export function persistCustomerDatabaseId(source: unknown): string | null {
  if (typeof window === 'undefined') return null;

  let uuid: string | null = null;
  if (typeof source === 'string') {
    const s = source.trim();
    if (isCustomerDatabaseUuid(s)) uuid = s;
  } else if (source && typeof source === 'object') {
    uuid = extractCustomerUuidFromProfile(source as Record<string, unknown>);
  }

  if (!uuid) return null;

  localStorage.setItem('customerId', uuid);
  localStorage.setItem('warmpawz_customer_id', uuid);
  localStorage.setItem('customer_id', uuid);

  try {
    const raw = localStorage.getItem('customerData');
    const parsed =
      raw && raw.trim()
        ? (JSON.parse(raw) as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    if (parsed && typeof parsed === 'object') {
      parsed.id = uuid;
      parsed.customer_id = uuid;
      localStorage.setItem('customerData', JSON.stringify(parsed));
    }
  } catch {
    /* ignore */
  }

  schedulePushRegistrationAfterLogin(uuid);
  return uuid;
}

/** Register FCM + device with API as soon as customer UUID is known (post-login). */
function schedulePushRegistrationAfterLogin(customerId: string): void {
  if (typeof window === 'undefined') return;
  if (!hasCustomerAppSession()) return;
  queueMicrotask(() => {
    void Promise.all([import('./push-bootstrap'), import('./api-client')]).then(
      ([{ bootstrapPushNotifications, ensureCapacitorPushRegistrationPipeline }, { apiClient }]) => {
        const opts = {
          userId: customerId,
          userType: 'customer' as const,
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          apiClient,
        };
        return ensureCapacitorPushRegistrationPipeline(opts).then(() =>
          bootstrapPushNotifications(opts)
        );
      }
    );
  });
}

/**
 * Resolve customer UUID from storage. Prefers validated UUIDs from `customerData` (unified profile)
 * over raw keys, so a stale non-UUID in `warmpawz_customer_id` cannot win.
 */
/** True when the user has a real customer auth session — not phone-only. */
export function hasCustomerAppSession(): boolean {
  if (typeof window === 'undefined') return false;
  const { hasAuthenticatedCustomerSession } = require('./guest-auth-gate');
  return hasAuthenticatedCustomerSession();
}

/**
 * Resolve customer UUID for push registration (by-phone when session exists but id keys are empty).
 */
export async function ensureResolvedCustomerIdForPush(
  getByPhone: (phone: string) => Promise<{ customer?: { id?: string }; id?: string }>
): Promise<string | null> {
  const existing = getResolvedCustomerId();
  if (existing) return existing;
  if (!hasCustomerAppSession()) return null;

  const phone = localStorage.getItem('customerPhone')?.trim();
  if (!phone || phone.replace(/\D/g, '').length < 10) return null;

  try {
    const res = await getByPhone(phone);
    const uuid = res?.customer?.id || res?.id;
    if (uuid && isCustomerDatabaseUuid(String(uuid))) {
      persistCustomerDatabaseId(String(uuid).trim());
      return String(uuid).trim();
    }
  } catch (err) {
    console.warn('[customer-id-storage] by-phone resolve for push failed:', err);
  }
  return null;
}

export function getResolvedCustomerId(): string | null {
  if (typeof window === 'undefined') return null;

  ensureCustomerIdStorageReconciledOnce();

  const fromKey = (k: string): string | null => {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    const s = v?.trim();
    return s && s.length > 0 ? s : null;
  };

  try {
    const raw = localStorage.getItem('customerData');
    if (raw) {
      const d = JSON.parse(raw) as Record<string, unknown>;
      const fromProfile = extractCustomerUuidFromProfile(d);
      if (fromProfile) return fromProfile;
    }
  } catch {
    /* ignore */
  }

  for (const key of STORAGE_KEYS) {
    const id = fromKey(key);
    if (id && isCustomerDatabaseUuid(id)) return id.trim();
  }

  return null;
}
