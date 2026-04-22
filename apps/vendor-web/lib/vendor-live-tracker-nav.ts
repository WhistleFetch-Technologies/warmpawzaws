const STORAGE_KEY = 'warmpawz_vendor_home_service_back_href';

/** Call before navigating to /bookings/home-service so Back returns to the right list. */
export function setHomeServiceTrackingReturnHref(href: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, href);
  } catch {
    /* ignore */
  }
}

export function consumeHomeServiceTrackingReturnHref(): string {
  if (typeof window === 'undefined') return '/bookings';
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (v && v.startsWith('/')) return v;
  } catch {
    /* ignore */
  }
  return '/bookings';
}

/**
 * When returning from live tracker to `/bookings?walkSessions=1`, the walk auto-open effect
 * would otherwise immediately replace back to home-service — set this once before navigating away.
 */
const SKIP_WALK_AUTO_KEY = 'warmpawz_vendor_skip_walk_live_redirect';

export function setSkipWalkAutoLiveTrackerOnce() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SKIP_WALK_AUTO_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** If set, clears the flag and returns true (skip one auto-open to live tracker). */
export function consumeSkipWalkAutoLiveTracker(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(SKIP_WALK_AUTO_KEY) === '1') {
      sessionStorage.removeItem(SKIP_WALK_AUTO_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
