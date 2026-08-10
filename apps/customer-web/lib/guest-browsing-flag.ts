/**
 * Guest browsing (home/shell without forced login).
 *
 * Toggle:
 *   • Locally — NEXT_PUBLIC_GUEST_BROWSING_ENABLED=true|false in .env.local
 *   • Deployed — runtime-config `guestBrowsingEnabled`
 *   • Default — false (preserve login-gated behaviour)
 *
 * Independent of booking / payment auth boundaries.
 */

type RuntimeConfig = {
  guestBrowsingEnabled?: boolean;
};

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: RuntimeConfig }).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

function parseExplicitEnv(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.toLowerCase().trim();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

/** When true, unauthenticated users may enter the app shell without /auth redirect. */
export function isGuestBrowsingEnabled(): boolean {
  const rc = getRuntimeConfig();
  if (typeof rc.guestBrowsingEnabled === 'boolean') return rc.guestBrowsingEnabled;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  return false;
}
