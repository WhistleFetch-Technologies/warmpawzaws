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

export const SEARCH_BOOKING_INTENT_KEY = 'warmpawz_search_booking_intent';

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
  if (c.includes('board')) return { persona: 'boarding', serviceStyle: 'at_center' };
  if (c.includes('walk')) return { persona: 'walker', serviceStyle: 'at_home' };
  if (c.includes('nutrition')) return { persona: 'nutritionist', serviceStyle: 'tele' };
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

function isVetLikeCategory(category: string): boolean {
  const c = (category || '').toLowerCase();
  return (
    c.includes('vet') ||
    c.includes('veterinar') ||
    c.includes('clinic') ||
    c === '' ||
    c.includes('medical')
  );
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

  if (isVendorServicePackageRow(serviceObj)) {
    const nav = buildWalkerServiceDataForVendorPackagePurchase({
      vendorId: String(vendorId),
      vendorName,
      serviceRow: serviceObj,
      serviceTypeCategory: persona === 'grooming' ? 'grooming' : persona === 'training' ? 'training' : 'vet',
      serviceStyle,
    });
    if (nav) {
      // Shell-only purchase-package — deep link with book intent (documented nav-exception).
      const bookServiceId = String(service.catalogServiceId || service.vendorServiceId);
      router.push(buildVendorBookDeepLink(vendorId, vendorName, category, bookServiceId));
      return;
    }
    toast.error('Could not start package booking. Please try again or pick another service.');
    return;
  }

  if (serviceStyle === 'tele' || category.toLowerCase().includes('tele')) {
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

  if (isVetLikeCategory(category) || persona === 'vet') {
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

  // Grooming / training / other — vendor book deep link fallback
  const bookServiceId = String(service.catalogServiceId || service.vendorServiceId);
  router.push(buildVendorBookDeepLink(vendorId, vendorName, category, bookServiceId));
}
