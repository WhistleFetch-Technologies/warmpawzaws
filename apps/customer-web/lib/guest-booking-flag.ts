/**
 * Guest booking initiation (customer-owned Book / Pay / create).
 *
 * Independent of GUEST_BROWSING_ENABLED.
 * Default false — guests may discover/search/view public slots, but
 * booking/purchase writes stay behind authentication.
 */

type RuntimeConfig = {
  guestBookingEnabled?: boolean;
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

/** When true, guest may stay in booking UI until a write/pay boundary. Default false. */
export function isGuestBookingEnabled(): boolean {
  const rc = getRuntimeConfig();
  if (typeof rc.guestBookingEnabled === 'boolean') return rc.guestBookingEnabled;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  return false;
}
