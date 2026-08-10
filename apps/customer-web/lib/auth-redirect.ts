/**
 * Safe post-login return path. Accepts both `redirect` and legacy `next`.
 */

const UNSAFE_PREFIXES = ['http://', 'https://', '//', 'javascript:'];

/** Prefer `redirect`, then `next`. Only same-origin relative paths. */
export function resolveSafeAuthReturnPath(
  search: string | URLSearchParams | null | undefined
): string | null {
  if (search == null) return null;
  const params =
    typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;

  const raw = (params.get('redirect') || params.get('next') || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  const lower = raw.toLowerCase();
  if (UNSAFE_PREFIXES.some((p) => lower.startsWith(p))) return null;
  return raw;
}

/** Build /auth URL with canonical `redirect=` (also readable as next by resolveSafeAuthReturnPath). */
export function buildAuthUrlWithReturn(returnPath: string): string {
  const safe = resolveSafeAuthReturnPath(`redirect=${encodeURIComponent(returnPath)}`) || '/';
  return `/auth?redirect=${encodeURIComponent(safe)}`;
}
