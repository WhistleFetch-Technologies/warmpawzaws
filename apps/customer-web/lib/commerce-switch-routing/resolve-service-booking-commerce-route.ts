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

/** Runtime module selection — no marketplace override when Warmpawz Pay is active. */
export function resolveServiceBookingCommerceRouteForNavigation(
  context: ServiceBookingRouteContext
): ServiceBookingCommerceRouteResult {
  return resolveServiceBookingCommerceRoute(context);
}
