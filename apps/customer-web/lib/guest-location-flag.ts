/**
 * Foreground LocationContext auto-prompt / GPS refresh.
 *
 * Toggle:
 *   • Locally — NEXT_PUBLIC_GUEST_LOCATION_ENABLED=true|false
 *   • Deployed — runtime-config `guestLocationEnabled`
 *   • Default — follows guest browsing when unset (so location foundation
 *     activates with guest entry in local/dev), else false.
 *
 * Does NOT enable background GPS. Does NOT enable guest booking.
 */

type RuntimeConfig = {
  guestLocationEnabled?: boolean;
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

export function isGuestLocationEnabled(): boolean {
  const rc = getRuntimeConfig();
  if (typeof rc.guestLocationEnabled === 'boolean') return rc.guestLocationEnabled;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GUEST_LOCATION_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  // Align with guest browsing when only browsing flag is set (dev convenience).
  if (typeof rc.guestBrowsingEnabled === 'boolean') return rc.guestBrowsingEnabled;

  const browsing = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED : undefined
  );
  if (browsing !== null) return browsing;

  return false;
}
