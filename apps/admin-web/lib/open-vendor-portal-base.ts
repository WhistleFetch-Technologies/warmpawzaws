/**
 * Target vendor-web origin for “Open vendor portal” from admin.
 *
 * Does NOT read NEXT_PUBLIC_VENDOR_WEB_URL — that env is often baked as http://localhost:3002
 * at build time and breaks deployed admin. Local dev uses numeric loopback only (no "localhost" in URL).
 */
const PROD_VENDOR = 'https://vendor.warmpawz.com';
const DEV_VENDOR = 'https://dev.vendor.warmpawz.com';

/**
 * `vendorWebUrl` is sometimes set to the raw S3 REST endpoint (bucket.s3.region.amazonaws.com). That
 * host does not serve SPA deep links: `/session/from-admin` has no object key → 404 or wrong
 * behavior. Dev traffic should use the public vendor host (CloudFront + `dev.vendor.warmpawz.com`).
 */
export function normalizeConfiguredVendorWebUrl(url: string): string {
  const t = (url || '').trim().replace(/\/+$/, '');
  if (!t) return t;
  if (/warmpawz-dev-vendor-frontend-ap-south-1\.s3[./]/i.test(t)) {
    return DEV_VENDOR;
  }
  if (/warmpawz-dev-vendor-frontend[^/?#]*\.s3[./]/i.test(t)) {
    return DEV_VENDOR;
  }
  return t;
}

/** When admin runs on this machine and the API is also local — open vendor-web on loopback (never the string "localhost"). */
export const LOCAL_VENDOR_ORIGIN = 'http://127.0.0.1:3002';

const PROD_API_MARKER = 'mss9sa4y01';

const PROD_ADMIN_HOSTS = new Set([
  'admin.warmpawz.com',
  'dbr09zyoq9akb.cloudfront.net',
  'd1y5ywletev82x.cloudfront.net',
  'dg69gqp2frh39.cloudfront.net',
]);

function isLoopbackAdminHost(host: string): boolean {
  if (!host) return false;
  if (host === '127.0.0.1') return true;
  if (host === 'localhost') return true;
  if (host.endsWith('.localhost')) return true;
  return false;
}

/** True when the admin app is talking to an API on this machine (pair with local vendor-web). */
export function isLocalApiBaseUrl(apiBaseUrl: string): boolean {
  const raw = (apiBaseUrl || '').trim();
  if (!raw) return true;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

/**
 * When admin UI is on loopback but `NEXT_PUBLIC`/runtime points API at deployed API Gateway,
 * open deployed vendor-web (HTTPS). Only use loopback vendor when the API base is local too.
 * Returns `null` when admin is not on loopback — caller should use host-based defaults.
 */
export function resolveVendorPortalOriginForLoopbackAdmin(apiBaseUrl: string): string | null {
  if (typeof window === 'undefined') return null;
  let host = (window.location.hostname || '').replace(/\.$/, '').toLowerCase();
  if (!host && window.location.href) {
    try {
      host = new URL(window.location.href).hostname.replace(/\.$/, '').toLowerCase();
    } catch {
      /* empty */
    }
  }
  if (!isLoopbackAdminHost(host)) return null;

  if (isLocalApiBaseUrl(apiBaseUrl)) {
    return LOCAL_VENDOR_ORIGIN;
  }
  if (apiBaseUrl.includes(PROD_API_MARKER)) {
    return PROD_VENDOR;
  }
  return DEV_VENDOR;
}

export function getOpenVendorPortalBaseUrl(): string {
  // SSR / pre-render: safe default (no env — avoids baked localhost)
  if (typeof window === 'undefined') {
    return DEV_VENDOR;
  }

  let host = (window.location.hostname || '').replace(/\.$/, '').toLowerCase();
  if (!host && window.location.href) {
    try {
      host = new URL(window.location.href).hostname.replace(/\.$/, '').toLowerCase();
    } catch {
      /* empty */
    }
  }

  if (isLoopbackAdminHost(host)) {
    // Without API context we cannot know if API is local — keep loopback default for SSR/edge cases.
    return LOCAL_VENDOR_ORIGIN;
  }

  if (PROD_ADMIN_HOSTS.has(host)) {
    return PROD_VENDOR;
  }

  // dev.admin, dev CloudFront, previews, unknown remote host → dev vendor (HTTPS only)
  return DEV_VENDOR;
}

// --- Customer web (admin "Open customer portal") — same pattern as vendor ---

const PROD_CUSTOMER = 'https://customer.warmpawz.com';
const DEV_CUSTOMER = 'https://d2aoyjj8ine0wk.cloudfront.net';
export const LOCAL_CUSTOMER_ORIGIN = 'http://127.0.0.1:3001';

/**
 * Default customer-web origin when opening the customer app from admin (parity with vendor portal base).
 */
export function getOpenCustomerPortalBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEV_CUSTOMER;
  }

  let host = (window.location.hostname || '').replace(/\.$/, '').toLowerCase();
  if (!host && window.location.href) {
    try {
      host = new URL(window.location.href).hostname.replace(/\.$/, '').toLowerCase();
    } catch {
      /* empty */
    }
  }

  if (host === '127.0.0.1' || host === 'localhost') {
    return LOCAL_CUSTOMER_ORIGIN;
  }

  if (PROD_ADMIN_HOSTS.has(host)) {
    return PROD_CUSTOMER;
  }

  return DEV_CUSTOMER;
}
