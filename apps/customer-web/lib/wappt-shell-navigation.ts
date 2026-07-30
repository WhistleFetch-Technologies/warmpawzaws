import {
  buildWarmpawzAppointmentsBookingNav,
  type WarmpawzAppointmentsBookingNav,
} from '@/lib/warmpawz-appointments-customer';
import { getWapptHubConfig, normalizeWapptHubCategory } from '@/lib/wappt-hub-registry';

export type WapptShellNavigateArgs = {
  category: string;
  screen: string;
  payload?: Record<string, unknown>;
  setWapptDiscoveryCategory: (category: string) => void;
  navigateToScreen: (screen: string) => void;
  mergeBookingState: (payload: Record<string, unknown>) => void;
};

/** Merge WAPPT nav payload with appointmentsMode for shell booking state. */
export function buildWapptShellBookingPayload(
  category: string,
  payload?: Record<string, unknown>,
): Record<string, unknown> {
  const hub = normalizeWapptHubCategory(category);
  const config = hub ? getWapptHubConfig(hub) : null;
  return {
    ...(payload || {}),
    appointmentsMode: true,
    category: hub ?? category,
    serviceType: hub ?? category,
    serviceStyle:
      payload?.serviceStyle ??
      config?.defaultServiceStyle ??
      'at_center',
    returnScreen: payload?.returnScreen ?? 'wappt-discovery',
  };
}

export function navigateWapptFromHub(args: WapptShellNavigateArgs): boolean {
  const { category, screen, payload, setWapptDiscoveryCategory, navigateToScreen, mergeBookingState } =
    args;
  const hub = normalizeWapptHubCategory(category);
  const config = hub ? getWapptHubConfig(hub) : null;

  if (screen === 'wappt-discovery') {
    setWapptDiscoveryCategory(hub ?? String(category));
    navigateToScreen('wappt-discovery');
    return true;
  }

  const bookingScreen = config?.bookingScreen;
  if (bookingScreen && (screen === bookingScreen || screen === 'grooming-booking' || screen === 'training-booking')) {
    const merged = buildWapptShellBookingPayload(hub ?? category, payload);
    mergeBookingState(merged);
    navigateToScreen(bookingScreen);
    return true;
  }

  return false;
}

export function wapptNavFromVendorCard(
  vendorId: string,
  opts: { category: string; serviceStyle: string; vendorName?: string },
): WarmpawzAppointmentsBookingNav {
  const hub = normalizeWapptHubCategory(opts.category) ?? opts.category;
  return buildWarmpawzAppointmentsBookingNav({
    vendorId,
    vendorName: opts.vendorName,
    serviceStyle: opts.serviceStyle,
    category: hub,
  });
}
