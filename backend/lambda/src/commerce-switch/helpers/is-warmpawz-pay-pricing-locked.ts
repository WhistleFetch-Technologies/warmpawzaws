import type { CommerceModelId } from '../contracts/commerce-model';
import { getCommerceResolver } from '../di/commerce-switch-container';

const WARMPAWZ_PAY_MODEL: CommerceModelId = 'warmpawz_pay';

/** at_home prices stay vendor-editable: they are a customer-facing menu; payment is via Pay Bill. */
const PRICING_LOCKED_STYLES = new Set(['at_center']);

/** Normalize vendor/customer service style to at_home | at_center | tele. */
export function normalizeServiceStyleForPricingLock(serviceStyle: string | null | undefined): string {
  const raw = String(serviceStyle || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (raw === 'at_vendor' || raw === 'clinic') return 'at_center';
  if (raw === 'home') return 'at_home';
  if (raw === 'online' || raw === 'video') return 'tele';
  return raw;
}

/** True for at_center only; at_home, tele and unknown styles are not locked. */
export function isPricingLockedServiceStyle(serviceStyle: string | null | undefined): boolean {
  return PRICING_LOCKED_STYLES.has(normalizeServiceStyleForPricingLock(serviceStyle));
}

export async function isWarmpawzPayActive(): Promise<boolean> {
  const resolved = await getCommerceResolver().resolveActiveModel({});
  return resolved.activeModelId === WARMPAWZ_PAY_MODEL;
}

/** Commerce Switch warmpawz_pay + at_center. */
export async function isWarmpawzPayPricingLocked(
  serviceStyle: string | null | undefined,
): Promise<boolean> {
  if (!isPricingLockedServiceStyle(serviceStyle)) return false;
  return isWarmpawzPayActive();
}

/** Strip price fields from a vendor service row for locked responses. */
export function stripVendorServicePriceFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const key of [
    'price',
    'customPrice',
    'custom_price',
    'basePrice',
    'base_price',
    'minPrice',
    'maxPrice',
  ]) {
    if (key in out) out[key] = null;
  }
  return out as T;
}

export function vendorServicePayloadHasPriceChange(body: Record<string, unknown>): boolean {
  return (
    body.price !== undefined ||
    body.customPrice !== undefined ||
    body.custom_price !== undefined
  );
}
