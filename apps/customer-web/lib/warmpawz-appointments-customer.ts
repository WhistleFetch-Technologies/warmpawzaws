import { isWarmpawzPay } from '@/lib/commerce-switch-client';
import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing';
import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing/warmpawz-pay-feature';
import { getWapptHubConfig, normalizeWapptHubCategory } from '@/lib/wappt-hub-registry';

export const WAPPT_APPOINTMENT_SERVICE_ID = 'warmpawz_appointments';
export const WAPPT_BOOKING_MODE = 'warmpawz_appointments' as const;
export const WAPPT_DEFAULT_SLOT_DURATION_MIN = 30;

export function isWarmpawzPayCommerceActive(): boolean {
  return isWarmpawzPay();
}

export function shouldHideMarketplaceStyleTiles(): boolean {
  return isWarmpawzPayCommerceActive();
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
