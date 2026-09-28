import { isWarmpawzPay } from '@/lib/commerce-switch-client';

/** at_home prices stay vendor-editable: customer-facing menu; the bill is settled via Pay Bill. */
const LOCKED_STYLES = new Set(['at_center', 'at_vendor', 'clinic']);

export function isPricingLockedServiceStyle(serviceStyle?: string | null): boolean {
  const raw = String(serviceStyle || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  return LOCKED_STYLES.has(raw);
}

/** Vendor may edit service price in marketplace mode, or for at_home / tele styles. */
export function canVendorEditServicePrice(serviceStyle?: string | null): boolean {
  if (!isWarmpawzPay()) return true;
  return !isPricingLockedServiceStyle(serviceStyle);
}

export function shouldHideVendorServicePrice(serviceStyle?: string | null): boolean {
  return !canVendorEditServicePrice(serviceStyle);
}

/** Vendor service promotions are platform-owned while Warmpawz Pay + Appointments is active. */
export function canVendorManageServicePromotions(): boolean {
  return !isWarmpawzPay();
}
