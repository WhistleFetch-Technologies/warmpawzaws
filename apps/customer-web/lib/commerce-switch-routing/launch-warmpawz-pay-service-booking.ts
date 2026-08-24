import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { buildWpayVendorPayPath } from '@/lib/warmpawz-pay/wpay-guest-journey';
import { mapServiceKeyToWpayCategory } from './map-service-to-wpay-category';
import { resolveServiceBookingCommerceRouteForNavigation } from './resolve-service-booking-commerce-route';
import type { ServiceBookingCommerceRouteResult } from './types';

/** True when Commerce Switch selected the Warmpawz Pay module for this service booking. */
export function isWarmpawzPayBookingFlow(route: ServiceBookingCommerceRouteResult): boolean {
  return !route.useMarketplaceFlow && route.effectiveModelId === 'warmpawz_pay';
}

/**
 * Existing Warmpawz Pay customer routes — vendor detail or category-filtered hub.
 * Does not duplicate Marketplace booking flows.
 */
export function launchWarmpawzPayServiceBooking(opts: {
  router: AppRouterInstance;
  serviceKey: string;
  category?: string;
  vendorId?: string;
}): void {
  const route = resolveServiceBookingCommerceRouteForNavigation({
    serviceKey: opts.serviceKey,
    category: opts.category ?? opts.serviceKey,
  });
  if (!isWarmpawzPayBookingFlow(route)) {
    return;
  }

  const vendorId = String(opts.vendorId ?? '').trim();
  if (vendorId) {
    opts.router.push(buildWpayVendorPayPath(vendorId));
    return;
  }

  const wpayCategory = mapServiceKeyToWpayCategory(opts.serviceKey, opts.category);
  const query = wpayCategory !== 'all' ? `?category=${encodeURIComponent(wpayCategory)}` : '';
  opts.router.push(`/warmpawz-pay${query}`);
}
