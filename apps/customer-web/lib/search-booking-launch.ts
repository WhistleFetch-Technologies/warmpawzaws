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
import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing';

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
}

export interface SearchNutritionBookingIntent {
  vendorId: string;
  vendorName?: string;
  category: string;
  serviceStyle?: string;
  returnSearchUrl?: string;
  nutritionist?: Record<string, unknown>;
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
  serviceStyle = 'at_center',
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
  router,
  returnSearchUrl,
}: {
  vendorId: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_TRAINING_CENTER_RETURN_KEY,
      JSON.stringify({ returnSearchUrl: returnSearchUrl || '/search?category=training' })
    );
  } catch {
    /* ignore */
  }
  router.push(`/training/center?vendorId=${encodeURIComponent(vendorId)}`);
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
  router,
  returnSearchUrl,
}: {
  vendorId: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_GROOMING_CENTER_RETURN_KEY,
      JSON.stringify({ returnSearchUrl: returnSearchUrl || '/search?category=grooming' })
    );
  } catch {
    /* ignore */
  }
  router.push(`/grooming/center?vendorId=${encodeURIComponent(vendorId)}`);
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
  router,
  returnSearchUrl,
}: {
  vendorId: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_BOARDING_CENTER_RETURN_KEY,
      JSON.stringify({ returnSearchUrl: returnSearchUrl || '/search?category=boarding' })
    );
  } catch {
    /* ignore */
  }
  router.push(
    `/pet-boarding/vendor/${encodeURIComponent(vendorId)}?service=all`
  );
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
  router,
  returnSearchUrl,
}: {
  vendorId: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_WALKER_CENTER_RETURN_KEY,
      JSON.stringify({ returnSearchUrl: returnSearchUrl || '/search?category=walker' })
    );
  } catch {
    /* ignore */
  }
  router.push(`/walker/vendor/${encodeURIComponent(vendorId)}`);
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
  router,
  returnSearchUrl,
}: {
  vendorId: string;
  router: AppRouterInstance;
  returnSearchUrl?: string;
}): void {
  try {
    sessionStorage.setItem(
      SEARCH_SITTING_CENTER_RETURN_KEY,
      JSON.stringify({ returnSearchUrl: returnSearchUrl || '/search?category=sitting' })
    );
  } catch {
    /* ignore */
  }
  router.push(`/pet-sitter/vendor/${encodeURIComponent(vendorId)}?service=all`);
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
}: SearchBookingLaunchParams): void {
  resolveServiceBookingCommerceRouteForNavigation({
    serviceKey: category,
    category,
    serviceStyle: serviceStyleOpt,
  });

  // Packages must route before category-specific one-off booking launches
  // (training/grooming/boarding/walker/sitting early returns used to skip this).
  {
    const { persona: earlyPersona, serviceStyle: earlyDefaultStyle } =
      resolveSearchCategoryPersona(category);
    const earlyServiceStyle = serviceStyleOpt || earlyDefaultStyle;
    const earlyServiceObj = normalizeVendorServiceRowForPackage({
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
    if (isVendorServicePackageRow(earlyServiceObj)) {
      const earlyPackageCategory = isNutritionCategory(category)
        ? 'nutrition'
        : earlyPersona === 'grooming'
          ? 'grooming'
          : earlyPersona === 'training'
            ? 'training'
            : earlyPersona === 'boarding'
              ? 'boarding'
              : earlyPersona === 'walker'
                ? 'walker'
                : earlyPersona === 'sitter'
                  ? 'sitting'
                  : earlyPersona === 'cafe'
                    ? 'cafe'
                    : earlyPersona === 'resort'
                      ? 'resort'
                      : earlyPersona === 'pharmacy'
                        ? 'pharmacy'
                        : 'vet';
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(vendorId),
        vendorName,
        serviceRow: earlyServiceObj,
        serviceTypeCategory: earlyPackageCategory,
        serviceStyle: earlyServiceStyle,
      });
      if (nav) {
        const bookServiceId = String(service.catalogServiceId || service.vendorServiceId);
        router.push(buildVendorBookDeepLink(vendorId, vendorName, category, bookServiceId));
        return;
      }
      toast.error('Could not start package booking. Please try again or pick another service.');
      return;
    }
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
      serviceStyle: serviceStyleOpt || 'at_center',
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
