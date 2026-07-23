import {
  COMMERCE_SWITCH_EXCLUDED_DOMAINS,
  type CommerceSwitchExcludedDomain,
} from '@warmpawz/commerce-switch-contracts';
import type { ServiceBookingRouteContext } from './types';

const EXCLUDED = new Set<string>(COMMERCE_SWITCH_EXCLUDED_DOMAINS);

function normalizeToken(value: string | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function matchesExcludedDomain(token: string): boolean {
  if (!token) return false;
  for (const domain of EXCLUDED) {
    if (token === domain || token.includes(domain)) return true;
  }
  return false;
}

/**
 * Fixed domains never consume Commerce Switch routing (tele, nutrition, shop, …).
 */
export function isCommerceExcludedService(context: ServiceBookingRouteContext): boolean {
  const tokens = [
    normalizeToken(context.serviceKey),
    normalizeToken(context.category),
    normalizeToken(context.serviceType),
    normalizeToken(context.serviceStyle),
  ].filter(Boolean);

  if (tokens.some((t) => t === 'tele' || t.includes('tele'))) return true;
  if (tokens.some((t) => matchesExcludedDomain(t))) return true;

  // Shop / checkout URL segments
  if (tokens.some((t) => t === 'shop' || t === 'cart' || t === 'checkout' || t === 'orders')) {
    return true;
  }

  return false;
}

export type { CommerceSwitchExcludedDomain };
