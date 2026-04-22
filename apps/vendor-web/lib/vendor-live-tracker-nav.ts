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
