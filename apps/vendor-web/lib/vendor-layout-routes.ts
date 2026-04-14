/**
 * Routes where the public vendor shell should not show global header/footer
 * (login, OTP, and nested paths under those segments).
 *
 * Includes `/vendor/login` and `/vendor/otp` for deployments that mount the app
 * under a `/vendor` URL prefix, plus the canonical Next routes under `/auth`.
 */
const AUTH_FULL_BLEED_SEGMENTS = [
  '/auth',
  /** When the app is served under a `/vendor` URL prefix (e.g. basePath or reverse proxy). */
  '/vendor/auth',
  '/vendor/login',
  '/vendor/otp',
] as const;

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** True when pathname is login/OTP flow (exact or nested, e.g. /auth/foo). */
export function pathnameMatchesVendorAuthFullBleed(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = normalizePathname(pathname);
  return AUTH_FULL_BLEED_SEGMENTS.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}
