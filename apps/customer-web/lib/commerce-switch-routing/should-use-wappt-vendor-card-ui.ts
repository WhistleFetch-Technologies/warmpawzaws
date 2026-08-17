import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';

/** True when vendor lists should use Warmpawz Pay dual-CTA cards (Commerce Switch → Pay). */
export function shouldUseWapptPayVendorCardUi(category: string): boolean {
  return isWarmpawzAppointmentsHubEnabled(category);
}

/** True when vendor discovery should load WAPPT by-category feed instead of marketplace discover-services. */
export function shouldUseWapptDiscoveryFeed(category: string): boolean {
  return isWarmpawzAppointmentsHubEnabled(category);
}
