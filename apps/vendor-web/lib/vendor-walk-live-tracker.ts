import { isVendorWalkerProgramProgress } from '@/lib/vendor-utils';

const WALK_SERVICE_HINT =
  /walk|walking|dog\s*walk|pet\s*walk|stroll|outing|leash|पैदल|walkathon/i;
/** Exclude obvious non-walk home visits when inferring from walker + at_home. */
const NON_WALK_HOME_HINT =
  /groom|bath|haircut|nail|vet\s|vaccin|dental|spa|trim|board|daycare|training\s*class|consult|pet\s*sit|house\s*sit|sitting/i;

/**
 * Bookings that should use `/bookings/home-service?bookingId=` (single live journey UI: start travel → map → OTP).
 * Catalog names may omit the word "walk"; walker + at_home is a strong signal.
 */
export function bookingNeedsWalkLiveTracker(booking: Record<string, any> | null | undefined, vendorData?: any): boolean {
  if (!booking) return false;
  const name = String(booking.serviceName || booking.service_name || '').toLowerCase();
  const cat = String(booking.serviceCategory || booking.service_category || '').toLowerCase();
  const hay = `${name} ${cat}`;
  if (WALK_SERVICE_HINT.test(hay)) return true;

  if (vendorData && isVendorWalkerProgramProgress(vendorData)) {
    const st = String(booking.serviceType || booking.service_type || '').toLowerCase();
    const atHome =
      st === 'at_home' ||
      st.includes('home') ||
      st.includes('home_visit') ||
      st.includes('home_service');
    if (
      atHome &&
      booking.status !== 'completed' &&
      booking.status !== 'cancelled' &&
      !NON_WALK_HOME_HINT.test(hay)
    ) {
      return true;
    }
  }
  return false;
}
