import {
  buildWarmpawzAppointmentsBookingNav,
  type WarmpawzAppointmentsBookingNav,
} from '@/lib/warmpawz-appointments-customer';
import {
  getWapptHubConfig,
  normalizeWapptHubCategory,
  type WapptHubCategory,
} from '@/lib/wappt-hub-registry';

export type WapptShellNavigateArgs = {
  category: string;
  screen: string;
  payload?: Record<string, unknown>;
  setWapptDiscoveryCategory: (category: string) => void;
  navigateToScreen: (screen: string) => void;
  mergeBookingState: (payload: Record<string, unknown>) => void;
};

export type WapptProfileShellState = {
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle: string;
  profileBackScreen: string;
};

export type WapptShellScreenActions = {
  setWapptProfileData: (data: WapptProfileShellState) => void;
  navigateToScreen: (screen: string, key?: string) => void;
  routeKeyVendor: (vendorId: string) => string;
  handleVetNavigate: (screen: string, payload: Record<string, unknown>) => void;
  mergeVetBookingState: (payload: Record<string, unknown>) => void;
  setWalkerBookingState: (payload: Record<string, unknown>) => void;
  openBoardingBooking: (payload: Record<string, unknown>) => void;
  openSittingBooking: (payload: Record<string, unknown>) => void;
};

const BOOKING_SCREEN_ALIASES = new Set([
  'vet-booking',
  'grooming-booking',
  'training-booking',
  'walker-booking',
  'boarding-booking',
  'pet-sitter-booking',
  'nutritionist-booking',
]);

function resolveHubCategory(category: string): WapptHubCategory | string {
  return normalizeWapptHubCategory(category) ?? category;
}

function isWapptBookingScreen(screen: string, bookingScreen?: string): boolean {
  if (!bookingScreen) return false;
  return screen === bookingScreen || BOOKING_SCREEN_ALIASES.has(screen);
}

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

/** Shared wappt-discovery / wappt-vendor-profile forward navigation for all 8 hubs. */
export function handleWapptShellScreenNavigate(
  discoveryCategory: string,
  screen: string,
  data: Record<string, unknown> | undefined,
  actions: WapptShellScreenActions,
): void {
  const hub = resolveHubCategory(discoveryCategory);
  const payload = buildWapptShellBookingPayload(String(hub), {
    ...(data || {}),
    returnScreen: 'wappt-discovery',
  });
  const hubConfig = normalizeWapptHubCategory(String(hub))
    ? getWapptHubConfig(normalizeWapptHubCategory(String(hub))!)
    : null;
  const bookingScreen = hubConfig?.bookingScreen;

  if (screen === 'wappt-vendor-profile') {
    actions.setWapptProfileData({
      vendorId: String(payload.vendorId || ''),
      vendorName: payload.vendorName as string | undefined,
      category: String(payload.category || hub),
      serviceStyle: String(payload.serviceStyle || 'at_center'),
      profileBackScreen: String(payload.profileBackScreen || 'wappt-discovery'),
    });
    actions.navigateToScreen(
      'wappt-vendor-profile',
      actions.routeKeyVendor(String(payload.vendorId || '')),
    );
    return;
  }

  if (hub === 'vet') {
    actions.mergeVetBookingState({
      ...payload,
      id: payload.vendorId || payload.id,
      vendorId: payload.vendorId,
    });
    actions.handleVetNavigate(screen, payload);
    return;
  }

  if (isWapptBookingScreen(screen, bookingScreen) && bookingScreen) {
    if (hub === 'walker') {
      actions.setWalkerBookingState(payload);
      actions.navigateToScreen('walker-booking');
      return;
    }
    if (hub === 'boarding') {
      actions.openBoardingBooking(payload);
      return;
    }
    if (hub === 'sitting') {
      actions.openSittingBooking({ ...payload, serviceType: 'sitting' });
      return;
    }
    actions.mergeVetBookingState(payload);
    actions.navigateToScreen(bookingScreen);
    return;
  }

  actions.navigateToScreen(screen);
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
  if (bookingScreen && isWapptBookingScreen(screen, bookingScreen)) {
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
