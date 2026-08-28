import { isWarmpawzPay } from '@/lib/commerce-switch-client';
import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing';
import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing/warmpawz-pay-feature';
import { getWapptHubConfig, normalizeWapptHubCategory } from '@/lib/wappt-hub-registry';

export const WAPPT_APPOINTMENT_SERVICE_ID = 'warmpawz_appointments';
export const WAPPT_BOOKING_MODE = 'warmpawz_appointments' as const;
export const WAPPT_DEFAULT_SLOT_DURATION_MIN = 30;

/** Catalogue appointment fee only — never fall back to marketplace service list price. */
export function wapptReviewAmount(appointmentFee: number | null | undefined): number {
  const n = Number(appointmentFee);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function isWarmpawzPayCommerceActive(): boolean {
  return isWarmpawzPay();
}

export function shouldHideMarketplaceStyleTiles(): boolean {
  return isWarmpawzPayCommerceActive();
}

/** Pay-mode hub tiles: hide marketplace style cards for every visitor, including guests. */
export function filterMarketplaceHubTiles<T extends { id: string }>(
  tiles: T[],
  options?: { keepIds?: string[] },
): T[] {
  if (!shouldHideMarketplaceStyleTiles()) return tiles;
  const keep = new Set(options?.keepIds ?? []);
  return tiles.filter((tile) => keep.has(tile.id));
}

export function isWarmpawzAppointmentsHubEnabled(category: string): boolean {
  const route = resolveServiceBookingCommerceRouteForNavigation({
    serviceKey: category,
    category,
  });
  const hub = normalizeWapptHubCategory(category);
  // Nutrition: general commerce is excluded, but WAPPT Book Appointment hub is allowed when Pay is active.
  if (route.excludedDomain && hub === 'nutrition' && isWarmpawzPayModuleCapable()) {
    return !route.useMarketplaceFlow;
  }
  if (hub && getWapptHubConfig(hub)) {
    return !route.useMarketplaceFlow && (!route.excludedDomain || hub === 'nutrition');
  }
  return !route.useMarketplaceFlow && !route.excludedDomain;
}

/** Boarding / sitting vendor lists use WAPPT when Commerce Switch routes to Pay. */
export function isWapptHubCategoryEnabled(category: 'boarding' | 'sitting'): boolean {
  return isWarmpawzAppointmentsHubEnabled(category);
}

/** Vet tele catalogue discovery when Warmpawz Pay is active (tele is commerce-excluded but uses WAPPT vendor list). */
export function isWarmpawzTeleCatalogueEnabled(): boolean {
  if (!isWarmpawzPayModuleCapable()) return false;
  return isWarmpawzPayCommerceActive();
}

export function buildWarmpawzTeleDiscoveryNav(opts?: {
  profileBackScreen?: string;
}): { screen: 'wappt-discovery'; category: string; serviceStyle: 'tele' } {
  return {
    screen: 'wappt-discovery',
    category: 'vet',
    serviceStyle: 'tele',
    ...(opts?.profileBackScreen ? { profileBackScreen: opts.profileBackScreen } : {}),
  };
}

export type WarmpawzAppointmentsBookingNav = {
  vendorId: string;
  vendorName?: string;
  serviceStyle: string;
  category: string;
  appointmentsMode: true;
  serviceId: typeof WAPPT_APPOINTMENT_SERVICE_ID;
  bookingMode: typeof WAPPT_APPOINTMENT_SERVICE_ID;
};

export function buildWarmpawzAppointmentsBookingNav(opts: {
  vendorId: string;
  vendorName?: string;
  serviceStyle: string;
  category: string;
}): WarmpawzAppointmentsBookingNav {
  return {
    vendorId: opts.vendorId,
    vendorName: opts.vendorName,
    serviceStyle: opts.serviceStyle,
    category: opts.category,
    appointmentsMode: true,
    serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
    bookingMode: WAPPT_APPOINTMENT_SERVICE_ID,
  };
}

export function isWarmpawzAppointmentsPaymentRequest(opts: {
  bookingMode?: string;
  serviceId?: string;
}): boolean {
  const sid = String(opts.serviceId ?? '').trim().toLowerCase();
  return opts.bookingMode === WAPPT_BOOKING_MODE || sid === WAPPT_APPOINTMENT_SERVICE_ID;
}

/** Book-a-slot appointment-fee checkout on Pay — wallet debit is not offered. */
export function isWalletDebitAllowedOnPaymentRequest(opts: {
  bookingMode?: string;
  serviceId?: string;
}): boolean {
  return !isWarmpawzAppointmentsPaymentRequest(opts);
}

export function resolveWarmpawzBookingCategory(serviceType?: string): string {
  const raw = String(serviceType || 'grooming').trim().toLowerCase();
  if (raw === 'vet' || raw === 'veterinarian') return 'vet';
  if (raw === 'training' || raw === 'trainer') return 'training';
  if (raw === 'behaviorist' || raw === 'behaviourist' || raw === 'pet_behaviorist') return 'behaviorist';
  if (raw === 'sitting' || raw === 'sitter' || raw === 'pet_sitter' || raw === 'pet-sitter') return 'sitting';
  if (raw === 'walker' || raw === 'walking') return 'walker';
  if (raw === 'boarding') return 'boarding';
  if (raw === 'nutrition' || raw === 'nutritionist') return 'nutrition';
  return raw || 'grooming';
}

export function resolveWarmpawzBookingScreen(category?: string): string {
  const hub = normalizeWapptHubCategory(resolveWarmpawzBookingCategory(category));
  const config = hub ? getWapptHubConfig(hub) : null;
  if (config) return config.bookingScreen;
  const cat = resolveWarmpawzBookingCategory(category);
  if (cat === 'vet') return 'vet-booking';
  if (cat === 'training') return 'training-booking';
  if (cat === 'sitting') return 'pet-sitter-booking';
  if (cat === 'walker') return 'walker-booking';
  if (cat === 'boarding') return 'boarding-booking';
  if (cat === 'nutrition') return 'nutritionist-booking';
  return 'grooming-booking';
}

export function getWarmpawzAppointmentServiceLabel(_opts?: {
  category?: string;
  serviceStyle?: string;
}): string {
  return 'Appointment';
}

export function isWarmpawzNutritionBookingRow(row: object | null | undefined): boolean {
  if (!row) return false;
  const r = row as Record<string, unknown>;
  const type = String(r.serviceType ?? r.service_type ?? r.category ?? '').toLowerCase();
  return type.includes('nutrition');
}

export function isWarmpawzAppointmentsBookingRow(
  row: object | null | undefined,
): boolean {
  if (!row) return false;
  const r = row as Record<string, unknown>;
  const commerceMode = String(r.commerceMode ?? r.commerce_mode ?? '').trim();
  if (commerceMode === WAPPT_BOOKING_MODE) return true;
  const bookingMode = String(r.bookingMode ?? r.booking_mode ?? '').trim();
  if (bookingMode === WAPPT_BOOKING_MODE) return true;
  const serviceId = String(r.serviceId ?? r.service_id ?? '').trim();
  if (serviceId === WAPPT_APPOINTMENT_SERVICE_ID) return true;
  const bookingServiceName = String(r.booking_service_name ?? r.bookingServiceName ?? '').trim().toLowerCase();
  if (bookingServiceName === 'appointment') return true;
  const serviceName = String(r.serviceName ?? r.service_name ?? '').trim().toLowerCase();
  return serviceName === 'appointment';
}

function catalogServiceNameFromRow(row: Record<string, unknown> | null | undefined): string {
  const joined = String(row?.joined_service_name ?? '').trim();
  const booking = String(row?.booking_service_name ?? row?.bookingServiceName ?? '').trim();
  const nestedService = row?.service && typeof row.service === 'object'
    ? String((row.service as Record<string, unknown>).name ?? '').trim()
    : '';
  const explicit = String(row?.serviceName ?? row?.service_name ?? '').trim();
  return joined || booking || explicit || nestedService;
}

export function resolveCustomerBookingDisplayName(
  row: object | null | undefined,
  fallback = 'Service',
): string {
  const r = row as Record<string, unknown> | null | undefined;
  const explicit = catalogServiceNameFromRow(r);
  if (!isWarmpawzAppointmentsBookingRow(row)) {
    if (explicit) return explicit;
    return fallback;
  }
  const serviceStyle = String(r?.serviceStyle ?? r?.service_style ?? '').toLowerCase();
  if (serviceStyle === 'tele') {
    return 'Tele Consultation';
  }
  if (isWarmpawzNutritionBookingRow(row)) {
    return explicit || fallback;
  }
  return getWarmpawzAppointmentServiceLabel();
}

export function shouldHideWarmpawzAppointmentDuration(
  row: object | null | undefined,
): boolean {
  return isWarmpawzAppointmentsBookingRow(row);
}

export function getWarmpawzBookingHeaderInfo(opts: {
  category: string;
  serviceStyle: string;
}): { title: string; subtitle: string } {
  const style = opts.serviceStyle;
  if (style === 'tele') {
    return { title: 'Tele Consultation', subtitle: 'Schedule, pet & details' };
  }
  if (style === 'at_home') {
    return { title: 'Book Appointment', subtitle: 'Schedule, pet & address' };
  }
  return { title: 'Book Appointment', subtitle: 'Schedule, pet & location' };
}

export function getWarmpawzAppointmentBookingTitle(category: string): {
  title: string;
  subtitle: string;
} {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return { title: 'Book Appointment', subtitle: `${label} · schedule & pay flat fee` };
}

export const WAPPT_VENDOR_PROFILE_SCREEN = 'wappt-vendor-profile' as const;

export type WarmpawzAppointmentsProfileNav = {
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle: string;
  profileBackScreen?: string;
};

export function buildWarmpawzAppointmentsProfileNav(opts: {
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle: string;
  profileBackScreen?: string;
}): WarmpawzAppointmentsProfileNav {
  return {
    vendorId: opts.vendorId,
    vendorName: opts.vendorName,
    category: opts.category,
    serviceStyle: opts.serviceStyle,
    profileBackScreen: opts.profileBackScreen ?? 'wappt-discovery',
  };
}
