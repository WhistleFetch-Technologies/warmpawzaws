import {
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelId,
} from '@warmpawz/commerce-switch-contracts';
import { getActiveCommerceModel } from '@/lib/commerce-switch-client';
import { getCommerceRouteAdapter } from './adapter-registry';
import { isCommerceExcludedService } from './is-commerce-excluded-service';
import type { ServiceBookingCommerceRouteResult, ServiceBookingRouteContext } from './types';

/**
 * Resolve which commerce model governs a service-booking navigation entry.
 * Callers must branch on `useMarketplaceFlow` / `effectiveModelId` — do not ignore the result.
 */
export function resolveServiceBookingCommerceRoute(
  context: ServiceBookingRouteContext
): ServiceBookingCommerceRouteResult {
  if (isCommerceExcludedService(context)) {
    return {
      configuredModelId: DEFAULT_COMMERCE_MODEL_ID,
      effectiveModelId: DEFAULT_COMMERCE_MODEL_ID,
      useMarketplaceFlow: true,
      excludedDomain: true,
    };
  }

  const configuredModelId = context.activeModelId ?? getActiveCommerceModel();

  if (configuredModelId === 'marketplace') {
    return {
      configuredModelId,
      effectiveModelId: 'marketplace',
      useMarketplaceFlow: true,
      excludedDomain: false,
    };
  }

  const adapter = getCommerceRouteAdapter(configuredModelId);
  if (!adapter.isAvailable()) {
    return {
      configuredModelId,
      effectiveModelId: 'marketplace',
      useMarketplaceFlow: true,
      excludedDomain: false,
      fallbackReason: 'warmpawz_pay_unavailable',
    };
  }

  return {
    configuredModelId,
    effectiveModelId: configuredModelId as CommerceModelId,
    useMarketplaceFlow: false,
    excludedDomain: false,
  };
}

/**
 * PR-9 safety: when Pay is selected but adapter is unavailable, fall back to Marketplace.
 */
export function applyMarketplaceNavigationFallback(
  route: ServiceBookingCommerceRouteResult
): ServiceBookingCommerceRouteResult {
  if (route.useMarketplaceFlow || route.excludedDomain) {
    return route;
  }

  const adapter = getCommerceRouteAdapter(route.configuredModelId);
  if (adapter.isAvailable()) {
    return route;
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[CommerceSwitch] warmpawz_pay selected but adapter unavailable; using marketplace',
      route
    );
  }

  return {
    ...route,
    effectiveModelId: 'marketplace',
    useMarketplaceFlow: true,
    fallbackReason: 'warmpawz_pay_unavailable',
  };
}

export function resolveServiceBookingCommerceRouteForNavigation(
  context: ServiceBookingRouteContext
): ServiceBookingCommerceRouteResult {
  return applyMarketplaceNavigationFallback(resolveServiceBookingCommerceRoute(context));
}
