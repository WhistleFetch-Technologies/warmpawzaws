import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { toast } from 'sonner';
import type { ClinicServiceRow } from '@/lib/clinic-service-row-mapper';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
  normalizeVendorServiceRowForPackage,
} from '@/lib/vendor-package-purchase-nav';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { buildVendorShareAppPath } from '@/lib/vendor-profile-share';
import {
  isBoardingCategory,
  isGroomingCategory,
  isNutritionCategory,
  isSittingCategory,
  isTrainingCategory,
  isWalkerCategory,
  isVetLikeCategory as isVetLikeCategoryDetect,
  isCafeCategory,
  isResortCategory,
  isPharmacyCategory,
} from '@/lib/search-category-detect';
import type { NutritionVendorCardModel } from '@/components/customer/nutrition/NutritionVendorDetailsCard';
import type { CommerceModelId } from '@warmpawz/commerce-switch-contracts';
import { getActiveCommerceModel } from '@/lib/commerce-switch-client';
import {
  isWarmpawzPayBookingFlow,
  launchWarmpawzPayServiceBooking,
  resolveServiceBookingCommerceRouteForNavigation,
} from '@/lib/commerce-switch-routing';
import {
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_DEFAULT_SLOT_DURATION_MIN,
  resolveWarmpawzBookingCategory,
} from '@/lib/warmpawz-appointments-customer';
import { getWapptHubConfig, normalizeWapptHubCategory } from '@/lib/wappt-hub-registry';

export const SEARCH_BOOKING_INTENT_KEY = 'warmpawz_search_booking_intent';
export const SEARCH_NUTRITION_BOOKING_INTENT_KEY = 'warmpawz_search_nutrition_booking_intent';
export const SEARCH_NUTRITION_MEAL_PLAN_VENDOR_KEY = 'warmpawz_search_nutrition_meal_plan_vendor';
export const SEARCH_TRAINING_BOOKING_INTENT_KEY = 'warmpawz_search_training_booking_intent';
export const SEARCH_TRAINING_CENTER_RETURN_KEY = 'warmpawz_search_training_center_return';
export const SEARCH_GROOMING_BOOKING_INTENT_KEY = 'warmpawz_search_grooming_booking_intent';
export const SEARCH_GROOMING_CENTER_RETURN_KEY = 'warmpawz_search_grooming_center_return';
export const SEARCH_BOARDING_BOOKING_INTENT_KEY = 'warmpawz_search_boarding_booking_intent';
export const SEARCH_BOARDING_CENTER_RETURN_KEY = 'warmpawz_search_boarding_center_return';
export const SEARCH_WALKER_BOOKING_INTENT_KEY = 'warmpawz_search_walker_booking_intent';
export const SEARCH_WALKER_CENTER_RETURN_KEY = 'warmpawz_search_walker_center_return';
export const SEARCH_SITTING_BOOKING_INTENT_KEY = 'warmpawz_search_sitting_booking_intent';
export const SEARCH_SITTING_CENTER_RETURN_KEY = 'warmpawz_search_sitting_center_return';
export const SEARCH_VET_CENTER_RETURN_KEY = 'warmpawz_search_vet_center_return';
/** Shared return key for `/search/vendor-profile` (WAPPT profile from search hubs). */
export const SEARCH_APPOINTMENTS_PROFILE_RETURN_KEY = 'warmpawz_search_wappt_profile_return';

export interface SearchVetBookingIntent {
  vendorId: string;
  vendorName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
  serviceStyle: string;
  serviceType: string;
  service: Record<string, unknown>;
  clinic: {
    id: string;
    name: string;
    address: string;
    rating: number;
    review_count: number;
    timing: string;
  };
  category: string;
  returnSearchUrl?: string;
  appointmentsMode?: boolean;
}

export interface SearchNutritionBookingIntent {
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle?: string;
  returnSearchUrl?: string;
  nutritionist?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchTrainingBookingIntent {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  serviceType?: string;
  returnSearchUrl?: string;
  trainer?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchGroomingBookingIntent {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  serviceType?: string;
  returnSearchUrl?: string;
  groomer?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchBoardingBookingIntent {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  serviceType?: string;
  returnSearchUrl?: string;
  facility?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchWalkerBookingIntent {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  serviceType?: string;
  returnSearchUrl?: string;
  walker?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchSittingBookingIntent {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  serviceType?: string;
  returnSearchUrl?: string;
  sitter?: Record<string, unknown>;
  appointmentsMode?: boolean;
}

export interface SearchBookingLaunchParams {
  vendorId: string;
  vendorName: string;
  service: ClinicServiceRow;
  category: string;
  serviceStyle?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  /** Prefer CommerceConfigProvider value; falls back to synced module cache. */
  activeModelId?: CommerceModelId;
}

export function resolveSearchCategoryPersona(category: string): {
  persona: string;
  serviceStyle: string;
} {
  const c = (category || '').toLowerCase();
  if (c.includes('groom')) return { persona: 'grooming', serviceStyle: 'at_center' };
  if (c.includes('train')) return { persona: 'training', serviceStyle: 'at_center' };
  if (isSittingCategory(c)) return { persona: 'sitter', serviceStyle: 'at_home' };
  if (c.includes('board')) return { persona: 'boarding', serviceStyle: 'at_center' };
  if (c.includes('walk')) return { persona: 'walker', serviceStyle: 'at_home' };
  if (isNutritionCategory(c)) return { persona: 'nutritionist', serviceStyle: 'at_center' };
  if (isCafeCategory(c)) return { persona: 'cafe', serviceStyle: 'at_center' };
  if (isResortCategory(c)) return { persona: 'resort', serviceStyle: 'at_center' };
  if (isPharmacyCategory(c)) return { persona: 'pharmacy', serviceStyle: 'at_center' };
  return { persona: 'vet', serviceStyle: 'at_center' };
}

/** Default WAPPT serviceStyle for a search hub category. */
export function resolveSearchHubAppointmentsServiceStyle(category: string): string {
  const hub = normalizeWapptHubCategory(category);
  const config = hub ? getWapptHubConfig(hub) : null;
  if (config) return config.defaultDiscoveryStyle;
  return resolveSearchCategoryPersona(category).serviceStyle;
}

/**
 * Search → Book Appointment vendor profile (WarmpawzAppointmentsVendorProfile).
 * Prefer this over marketplace `/grooming/center`, `/vendor/...`, etc.
 */
export function buildSearchAppointmentsVendorProfileUrl(opts: {
  vendorId: string;
  category: string;
  vendorName?: string;
  serviceStyle?: string;
}): string {
  const category =
    normalizeWapptHubCategory(opts.category) ||
    resolveWarmpawzBookingCategory(opts.category) ||
    'grooming';
  const serviceStyle =
    opts.serviceStyle?.trim() || resolveSearchHubAppointmentsServiceStyle(category);
  const qs = new URLSearchParams();
  qs.set('vendorId', opts.vendorId);
  qs.set('category', category);
  qs.set('serviceStyle', serviceStyle);
  if (opts.vendorName?.trim()) qs.set('vendorName', opts.vendorName.trim());
  return `/search/vendor-profile?${qs.toString()}`;
}

function persistSearchAppointmentsProfileReturn(
  category: string,
  returnSearchUrl?: string
): string {
  const url = returnSearchUrl || `/search?category=${encodeURIComponent(category)}`;
  const payload = JSON.stringify({ returnSearchUrl: url, category });
  try {
    sessionStorage.setItem(SEARCH_APPOINTMENTS_PROFILE_RETURN_KEY, payload);
    const hub = normalizeWapptHubCategory(category);
    if (hub === 'grooming') sessionStorage.setItem(SEARCH_GROOMING_CENTER_RETURN_KEY, payload);
    else if (hub === 'training' || hub === 'behaviorist')
      sessionStorage.setItem(SEARCH_TRAINING_CENTER_RETURN_KEY, payload);
    else if (hub === 'boarding') sessionStorage.setItem(SEARCH_BOARDING_CENTER_RETURN_KEY, payload);
    else if (hub === 'walker') sessionStorage.setItem(SEARCH_WALKER_CENTER_RETURN_KEY, payload);
    else if (hub === 'sitting') sessionStorage.setItem(SEARCH_SITTING_CENTER_RETURN_KEY, payload);
    else if (hub === 'vet') sessionStorage.setItem(SEARCH_VET_CENTER_RETURN_KEY, payload);
  } catch {
    /* ignore */
  }
  return url;
}

export function readSearchAppointmentsProfileReturnUrl(fallback = '/search'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(SEARCH_APPOINTMENTS_PROFILE_RETURN_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { returnSearchUrl?: string };
    return parsed.returnSearchUrl || fallback;
  } catch {
    return fallback;
  }
}

/** Open shared WAPPT vendor profile from any search hub card. */
export function launchSearchHubAppointmentsVendorProfile(opts: {
  vendorId: string;
  category: string;
  vendorName?: string;
  serviceStyle?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  const category =
    normalizeWapptHubCategory(opts.category) ||
    resolveWarmpawzBookingCategory(opts.category) ||
    'grooming';
  persistSearchAppointmentsProfileReturn(category, opts.returnSearchUrl);
  opts.router.push(
    buildSearchAppointmentsVendorProfileUrl({
      vendorId: opts.vendorId,
      category,
      vendorName: opts.vendorName,
      serviceStyle: opts.serviceStyle,
    })
  );
}

/**
 * Handle WarmpawzAppointmentsVendorProfile onNavigate from `/search/vendor-profile`.
 * Stores appointmentsMode booking intent and opens the matching `/booking/*` URL page.
 */
export function launchSearchAppointmentsBookingFromProfile(opts: {
  screen: string;
  data?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl: string;
  fallbackCategory: string;
  fallbackVendorId: string;
}): boolean {
  const data = opts.data || {};
  const screen = opts.screen;
  const bookingScreens = new Set([
    'grooming-booking',
    'training-booking',
    'vet-booking',
    'walker-booking',
    'boarding-booking',
    'pet-sitter-booking',
    'nutritionist-booking',
    'booking',
    'create-booking',
  ]);
  if (!bookingScreens.has(screen)) {
    if (screen === 'booking-details' || screen === 'booking-confirmation') {
      const bookingId = data.bookingId;
      if (bookingId) {
        opts.router.push(`/bookings?highlight=${encodeURIComponent(String(bookingId))}`);
        return true;
      }
    }
    if (screen === 'my-bookings') {
      opts.router.push('/bookings');
      return true;
    }
    return false;
  }

  const vendorId = String(data.vendorId || opts.fallbackVendorId || '').trim();
  if (!vendorId) return false;

  const category = resolveWarmpawzBookingCategory(
    String(data.category || opts.fallbackCategory || 'grooming')
  );
  const hub = normalizeWapptHubCategory(category) || category;
  const vendorName = data.vendorName ? String(data.vendorName) : undefined;
  const serviceStyle =
    (data.serviceStyle ? String(data.serviceStyle) : undefined) ||
    resolveSearchHubAppointmentsServiceStyle(hub);
  const appointmentsMode = data.appointmentsMode !== false;
  const serviceId = appointmentsMode
    ? WAPPT_APPOINTMENT_SERVICE_ID
    : data.serviceId
      ? String(data.serviceId)
      : undefined;
  const returnSearchUrl = opts.returnSearchUrl;

  try {
    if (hub === 'vet') {
      const name = vendorName || 'Provider';
      const intent: SearchVetBookingIntent = {
        vendorId,
        vendorName: name,
        serviceId: serviceId || WAPPT_APPOINTMENT_SERVICE_ID,
        serviceName: data.serviceName ? String(data.serviceName) : 'Appointment',
        price: typeof data.price === 'number' ? data.price : 0,
        duration:
          typeof data.duration === 'number' ? data.duration : WAPPT_DEFAULT_SLOT_DURATION_MIN,
        serviceStyle,
        serviceType: String(data.serviceType || serviceStyle || 'at_center'),
        service: (data.service as Record<string, unknown>) || {},
        clinic: {
          id: vendorId,
          name,
          address: '',
          rating: 0,
          review_count: 0,
          timing: '',
        },
        category: 'vet',
        returnSearchUrl,
        appointmentsMode,
      };
      sessionStorage.setItem(SEARCH_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/vet');
      return true;
    }
    if (hub === 'grooming') {
      const intent: SearchGroomingBookingIntent = {
        vendorId,
        vendorName,
        serviceId,
        serviceName: data.serviceName ? String(data.serviceName) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        serviceStyle,
        serviceType: 'grooming',
        returnSearchUrl,
        appointmentsMode,
        groomer:
          (data.vendor as Record<string, unknown>) ||
          (data.groomer as Record<string, unknown>) ||
          (vendorName
            ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
            : undefined),
      };
      sessionStorage.setItem(SEARCH_GROOMING_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/grooming');
      return true;
    }
    if (hub === 'training' || hub === 'behaviorist') {
      const intent: SearchTrainingBookingIntent = {
        vendorId,
        vendorName,
        serviceId,
        serviceName: data.serviceName ? String(data.serviceName) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        serviceStyle,
        serviceType: hub === 'behaviorist' ? 'behaviorist' : 'training',
        returnSearchUrl,
        appointmentsMode,
        trainer:
          (data.vendor as Record<string, unknown>) ||
          (data.trainer as Record<string, unknown>) ||
          (vendorName
            ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
            : undefined),
      };
      sessionStorage.setItem(SEARCH_TRAINING_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/training');
      return true;
    }
    if (hub === 'boarding') {
      const intent: SearchBoardingBookingIntent = {
        vendorId,
        vendorName,
        serviceId,
        serviceName: data.serviceName ? String(data.serviceName) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        serviceStyle,
        serviceType: 'boarding',
        returnSearchUrl,
        appointmentsMode,
        facility:
          (data.facility as Record<string, unknown>) ||
          (vendorName
            ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
            : undefined),
      };
      sessionStorage.setItem(SEARCH_BOARDING_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/boarding');
      return true;
    }
    if (hub === 'walker') {
      const intent: SearchWalkerBookingIntent = {
        vendorId,
        vendorName,
        serviceId,
        serviceName: data.serviceName ? String(data.serviceName) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        serviceStyle,
        serviceType: 'walking',
        returnSearchUrl,
        appointmentsMode,
        walker:
          (data.walker as Record<string, unknown>) ||
          (vendorName
            ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
            : undefined),
      };
      sessionStorage.setItem(SEARCH_WALKER_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/walker');
      return true;
    }
    if (hub === 'sitting') {
      const intent: SearchSittingBookingIntent = {
        vendorId,
        vendorName,
        serviceId,
        serviceName: data.serviceName ? String(data.serviceName) : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        serviceStyle,
        serviceType: 'sitting',
        returnSearchUrl,
        appointmentsMode,
        sitter:
          (data.sitter as Record<string, unknown>) ||
          (vendorName
            ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
            : undefined),
      };
      sessionStorage.setItem(SEARCH_SITTING_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/sitting');
      return true;
    }
    if (hub === 'nutrition') {
      const intent: SearchNutritionBookingIntent = {
        vendorId,
        vendorName,
        category: 'nutrition',
        serviceStyle,
        returnSearchUrl,
        appointmentsMode,
        nutritionist:
          (data.nutritionist as Record<string, unknown>) ||
          (vendorName ? { id: vendorId, name: vendorName } : undefined),
      };
      sessionStorage.setItem(SEARCH_NUTRITION_BOOKING_INTENT_KEY, JSON.stringify(intent));
      opts.router.push('/booking/nutrition');
      return true;
    }
  } catch {
    /* ignore quota */
  }
  return false;
}

/** Vendor profile deep link — same entry as Services "Details" (VendorShareDeepLinkClient). */
export function buildSearchVendorDetailsUrl(
  vendorId: string,
  vendorName: string,
  category: string
): string {
  const { persona, serviceStyle } = resolveSearchCategoryPersona(category);
  const path = buildVendorShareAppPath(vendorId, {
    persona,
    serviceStyle,
    intent: 'profile',
    vendorName,
  });
  return path.replace('/vendor/placeholder', `/vendor/${encodeURIComponent(vendorId)}`);
}

function buildVendorBookDeepLink(
  vendorId: string,
  vendorName: string,
  category: string,
  serviceId: string
): string {
  const { persona, serviceStyle } = resolveSearchCategoryPersona(category);
  const path = buildVendorShareAppPath(vendorId, {
    persona,
    serviceStyle,
    intent: 'book',
    vendorName,
    serviceId,
  });
  return path.replace('/vendor/placeholder', `/vendor/${encodeURIComponent(vendorId)}`);
}

export function launchSearchNutritionBooking({
  vendorId,
  vendorName,
  nutritionist,
  router,
  returnSearchUrl,
  serviceStyle = 'tele',
}: {
  vendorId: string;
  vendorName?: string;
  nutritionist?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchNutritionBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    category: 'pet_nutritionist',
    serviceStyle,
    returnSearchUrl,
    nutritionist,
  };
  try {
    sessionStorage.setItem(SEARCH_NUTRITION_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota */
  }
  router.push('/booking/nutrition');
}

export function launchSearchTrainingBooking({
  vendorId,
  vendorName,
  serviceId,
  serviceName,
  price,
  duration,
  trainer,
  router,
  returnSearchUrl,
  serviceStyle = 'at_center',
}: {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  trainer?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchTrainingBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    serviceId: serviceId ? String(serviceId) : undefined,
    serviceName,
    price,
    duration,
    serviceStyle,
    serviceType: 'training',
    returnSearchUrl,
    trainer:
      trainer ||
      (vendorName
        ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
        : undefined),
  };
  try {
    sessionStorage.setItem(SEARCH_TRAINING_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota */
  }
  router.push('/booking/training');
}

export function launchSearchTrainingCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'training',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=training',
  });
}

export function launchSearchGroomingBooking({
  vendorId,
  vendorName,
  serviceId,
  serviceName,
  price,
  duration,
  groomer,
  router,
  returnSearchUrl,
  serviceStyle = 'at_center',
}: {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  groomer?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchGroomingBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    serviceId: serviceId ? String(serviceId) : undefined,
    serviceName,
    price,
    duration,
    serviceStyle,
    serviceType: 'grooming',
    returnSearchUrl,
    groomer:
      groomer ||
      (vendorName
        ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
        : undefined),
  };
  try {
    sessionStorage.setItem(SEARCH_GROOMING_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota */
  }
  router.push('/booking/grooming');
}

export function launchSearchGroomingCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'grooming',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=grooming',
  });
}

export function launchSearchVetCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'vet',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=vet',
  });
}

export function launchSearchBoardingBooking({
  vendorId,
  vendorName,
  serviceId,
  serviceName,
  price,
  duration,
  facility,
  router,
  returnSearchUrl,
  serviceStyle = 'at_center',
}: {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  facility?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchBoardingBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    serviceId: serviceId ? String(serviceId) : undefined,
    serviceName,
    price,
    duration,
    serviceStyle,
    serviceType: 'boarding',
    returnSearchUrl,
    facility:
      facility ||
      (vendorName
        ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
        : undefined),
  };
  try {
    sessionStorage.setItem(SEARCH_BOARDING_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota */
  }
  router.push('/booking/boarding');
}

export function launchSearchBoardingCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'boarding',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=boarding',
  });
}

export function launchSearchWalkerBooking({
  vendorId,
  vendorName,
  serviceId,
  serviceName,
  price,
  duration,
  walker,
  router,
  returnSearchUrl,
  serviceStyle = 'at_home',
}: {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  walker?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchWalkerBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    serviceId: serviceId ? String(serviceId) : undefined,
    serviceName,
    price,
    duration,
    serviceStyle,
    serviceType: 'walking',
    returnSearchUrl,
    walker:
      walker ||
      (vendorName
        ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
        : undefined),
  };
  try {
    sessionStorage.setItem(SEARCH_WALKER_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
  router.push('/booking/walker');
}

export function launchSearchWalkerCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'walker',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=walker',
  });
}

export function launchSearchSittingBooking({
  vendorId,
  vendorName,
  serviceId,
  serviceName,
  price,
  duration,
  sitter,
  router,
  returnSearchUrl,
  serviceStyle = 'at_home',
}: {
  vendorId: string;
  vendorName?: string;
  serviceId?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  sitter?: Record<string, unknown>;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  const intent: SearchSittingBookingIntent = {
    vendorId: String(vendorId),
    vendorName,
    serviceId: serviceId ? String(serviceId) : undefined,
    serviceName,
    price,
    duration,
    serviceStyle,
    serviceType: 'sitting',
    returnSearchUrl,
    sitter:
      sitter ||
      (vendorName
        ? { id: vendorId, vendorId, name: vendorName, businessName: vendorName }
        : undefined),
  };
  try {
    sessionStorage.setItem(SEARCH_SITTING_BOOKING_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
  router.push('/booking/sitting');
}

export function launchSearchSittingCenterProfile({
  vendorId,
  vendorName,
  router,
  returnSearchUrl,
  serviceStyle,
}: {
  vendorId: string;
  vendorName?: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
  serviceStyle?: string;
}): void {
  launchSearchHubAppointmentsVendorProfile({
    vendorId,
    vendorName,
    category: 'sitting',
    serviceStyle,
    router,
    returnSearchUrl: returnSearchUrl || '/search?category=sitting',
  });
}

export function launchSearchNutritionMealPlans({
  vendorId,
  vendorSnapshot,
  router,
}: {
  vendorId: string;
  vendorSnapshot?: NutritionVendorCardModel;
  router: AppRouterInstance;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_NUTRITION_MEAL_PLAN_VENDOR_KEY,
      JSON.stringify({ vendorId, vendorSnapshot })
    );
  } catch {
    /* ignore */
  }
  router.push(`/nutrition/meal-plans?vendorId=${encodeURIComponent(vendorId)}`);
}

/**
 * Launch booking from /search — mirrors ClinicListView.handleBookService for vet clinics.
 */
export function launchSearchServiceBooking({
  vendorId,
  vendorName,
  service,
  category,
  serviceStyle: serviceStyleOpt,
  address = '',
  rating = 0,
  reviewCount = 0,
  router,
  returnSearchUrl,
  activeModelId: activeModelIdParam,
}: SearchBookingLaunchParams): void {
  const activeModelId = activeModelIdParam ?? getActiveCommerceModel();
  const commerceRoute = resolveServiceBookingCommerceRouteForNavigation({
    serviceKey: category,
    category,
    serviceStyle: serviceStyleOpt,
    activeModelId,
  });

  if (isWarmpawzPayBookingFlow(commerceRoute)) {
    launchWarmpawzPayServiceBooking({
      router,
      serviceKey: category,
      category,
      vendorId,
    });
    return;
  }

  if (isNutritionCategory(category)) {
    launchSearchNutritionBooking({
      vendorId,
      vendorName,
      nutritionist: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'tele',
    });
    return;
  }

  if (isTrainingCategory(category)) {
    launchSearchTrainingBooking({
      vendorId,
      vendorName,
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      trainer: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'at_center',
    });
    return;
  }

  if (isGroomingCategory(category)) {
    launchSearchGroomingBooking({
      vendorId,
      vendorName,
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      groomer: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'at_center',
    });
    return;
  }

  if (isBoardingCategory(category)) {
    launchSearchBoardingBooking({
      vendorId,
      vendorName,
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      facility: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'at_center',
    });
    return;
  }

  if (isWalkerCategory(category)) {
    launchSearchWalkerBooking({
      vendorId,
      vendorName,
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      walker: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'at_home',
    });
    return;
  }

  if (isSittingCategory(category)) {
    launchSearchSittingBooking({
      vendorId,
      vendorName,
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      sitter: {
        id: vendorId,
        vendorId,
        name: vendorName,
        businessName: vendorName,
      },
      router,
      returnSearchUrl,
      serviceStyle: serviceStyleOpt || 'at_home',
    });
    return;
  }

  const { persona, serviceStyle: defaultStyle } = resolveSearchCategoryPersona(category);
  const serviceStyle = serviceStyleOpt || defaultStyle;

  const serviceObj = normalizeVendorServiceRowForPackage({
    id: String(service.vendorServiceId),
    serviceId: service.catalogServiceId,
    vendorServiceId: service.vendorServiceId,
    name: service.name,
    price: service.price,
    duration: service.duration,
    isPackage: service.isPackage,
    packageDetails: service.packageDetails,
    metadata: service.metadata,
  });

  const packageCategory =
    persona === 'grooming'
      ? 'grooming'
      : persona === 'training'
        ? 'training'
        : persona === 'boarding'
          ? 'boarding'
          : persona === 'walker'
            ? 'walker'
            : persona === 'sitter'
              ? 'sitting'
              : persona === 'cafe'
                ? 'cafe'
                : persona === 'resort'
                  ? 'resort'
                  : persona === 'pharmacy'
                    ? 'pharmacy'
                    : 'vet';

  if (isVendorServicePackageRow(serviceObj)) {
    const nav = buildWalkerServiceDataForVendorPackagePurchase({
      vendorId: String(vendorId),
      vendorName,
      serviceRow: serviceObj,
      serviceTypeCategory: isNutritionCategory(category) ? 'nutrition' : packageCategory,
      serviceStyle,
    });
    if (nav) {
      const bookServiceId = String(service.catalogServiceId || service.vendorServiceId);
      router.push(buildVendorBookDeepLink(vendorId, vendorName, category, bookServiceId));
      return;
    }
    toast.error('Could not start package booking. Please try again or pick another service.');
    return;
  }

  // Vet tele only — never route nutrition/training/grooming/boarding/walker/sitting through instant tele
  if (
    !isNutritionCategory(category) &&
    !isTrainingCategory(category) &&
    !isGroomingCategory(category) &&
    !isBoardingCategory(category) &&
    !isWalkerCategory(category) &&
    !isSittingCategory(category) &&
    (serviceStyle === 'tele' || category.toLowerCase().includes('tele'))
  ) {
    const teleUrl = buildTeleInstantAutoPayBookingUrl({
      serviceId: String(service.catalogServiceId || service.vendorServiceId),
      vendorId: String(vendorId),
      category,
    });
    if (teleUrl) {
      router.push(teleUrl);
      return;
    }
  }

  if (isVetLikeCategoryDetect(category) || persona === 'vet') {
    const serviceIdForBooking = service.catalogServiceId || String(service.vendorServiceId);
    const intent: SearchVetBookingIntent = {
      vendorId: String(vendorId),
      vendorName,
      serviceId: serviceIdForBooking,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      serviceStyle: 'at_center',
      serviceType: 'at_center',
      service: serviceObj,
      clinic: {
        id: String(vendorId),
        name: vendorName,
        address,
        rating,
        review_count: reviewCount,
        timing: '9 AM - 8 PM',
      },
      category,
      returnSearchUrl,
    };
    try {
      sessionStorage.setItem(SEARCH_BOOKING_INTENT_KEY, JSON.stringify(intent));
    } catch {
      /* ignore quota */
    }
    router.push('/booking/vet');
    return;
  }

  const bookServiceId = String(service.catalogServiceId || service.vendorServiceId);
  router.push(buildVendorBookDeepLink(vendorId, vendorName, category, bookServiceId));
}
