import type { CommerceModelId } from '@warmpawz/commerce-switch-contracts';

export interface ServiceBookingRouteContext {
  /** Shell service key or search category slug */
  serviceKey: string;
  category?: string;
  serviceStyle?: string;
  serviceType?: string;
}

export interface ServiceBookingCommerceRouteResult {
  /** Model from Commerce Switch config (before fallback) */
  configuredModelId: CommerceModelId;
  /** Model used for navigation after adapter + availability checks */
  effectiveModelId: CommerceModelId;
  /** When true, callers must use existing Marketplace navigation paths */
  useMarketplaceFlow: boolean;
  /** Fixed domains (tele, nutrition, shop, …) skip Commerce Switch routing */
  excludedDomain: boolean;
  /** Present when effective model differs from configured (safe fallback) */
  fallbackReason?: string;
}

export interface CommerceRouteAdapter {
  modelId: CommerceModelId;
  /** Capability probe only — no business or payment logic */
  isAvailable(): boolean;
}
