import { isWarmpawzPay } from '@/lib/commerce-switch-client';

const LOCKED_STYLES = new Set(['at_home', 'at_center', 'at_vendor', 'clinic', 'home']);

export function isPricingLockedServiceStyle(serviceStyle?: string | null): boolean {
  const raw = String(serviceStyle || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (raw === 'home') return true;
  if (raw === 'at_vendor' || raw === 'clinic') return true;
  return LOCKED_STYLES.has(raw);
}

/** Vendor may edit service price only when marketplace mode, tele style, or the row is a package. */
export function canVendorEditServicePrice(
  serviceStyle?: string | null,
  opts?: { isPackage?: boolean },
): boolean {
  if (opts?.isPackage) return true;
  if (!isWarmpawzPay()) return true;
  return !isPricingLockedServiceStyle(serviceStyle);
}

export function shouldHideVendorServicePrice(
  serviceStyle?: string | null,
  opts?: { isPackage?: boolean },
): boolean {
  return !canVendorEditServicePrice(serviceStyle, opts);
}
