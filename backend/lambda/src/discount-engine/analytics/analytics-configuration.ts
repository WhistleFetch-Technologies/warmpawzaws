export const ANALYTICS_VERSION = '1.0.0';

export const DEFAULT_ANALYTICS_LIMIT = 50;

export const ANALYTICS_REGISTRY_DOMAINS = [
  'ALL',
  'SERVICE',
  'PACKAGE',
  'MEAL',
  'PHARMACY',
  'PRODUCT',
] as const;

/** Maps promotion_usages.promotion_type to analytics domain. */
export const PROMOTION_TYPE_TO_DOMAIN: Record<string, string> = {
  service: 'SERVICE',
  platform: 'SERVICE',
  product: 'PRODUCT',
};
