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

function buildAuthUrlWithMode(returnPath: string, mode: 'signup' | 'login'): string {
  const safe = resolveSafeAuthReturnPath(`redirect=${encodeURIComponent(returnPath)}`) || '/';
  const modeParam = mode === 'signup' ? 'signup=1' : 'login=1';
  return `/auth?${modeParam}&redirect=${encodeURIComponent(safe)}`;
}

/** OTP signup entry — guest conversion, booking, add pet. */
export function buildAuthSignupUrl(returnPath: string): string {
  return buildAuthUrlWithMode(returnPath, 'signup');
}

/** Password login entry — returning users, sidebar Login. */
export function buildAuthLoginUrl(returnPath: string): string {
  return buildAuthUrlWithMode(returnPath, 'login');
}

/** Guest conversion default: signup OTP with safe return path. */
export function buildAuthUrlWithReturn(returnPath: string): string {
  return buildAuthSignupUrl(returnPath);
}

/** Resolve auth screen from URL query (client-only). */
export function resolveAuthModeFromParams(
  params: URLSearchParams
): 'login' | 'signup' {
  const forceLogin = params.get('login') === '1' || params.get('forceLogin') === '1';
  const forceSignup = params.get('signup') === '1';
  const hasRef = !!(params.get('ref') || params.get('referral') || params.get('referralCode'));
  const hasRedirect = !!resolveSafeAuthReturnPath(params);

  if (forceLogin) return 'login';
  if (forceSignup || hasRef) return 'signup';
  if (hasRedirect) return 'signup';
  return 'login';
}
