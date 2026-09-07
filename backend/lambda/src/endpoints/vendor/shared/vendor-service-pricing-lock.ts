import {
  isWarmpawzPayActive,
  isWarmpawzPayPricingLocked,
  isPricingLockedServiceStyle,
  stripVendorServicePriceFields,
  vendorServicePayloadHasPriceChange,
  type WarmpawzPayPricingLockOpts,
} from '../../../commerce-switch/helpers/is-warmpawz-pay-pricing-locked';
import { isVendorServicePackagePayload, isVendorServicePackageRow } from '../../../utils/vendor-service-is-package';

export {
  isWarmpawzPayActive,
  isWarmpawzPayPricingLocked,
  isPricingLockedServiceStyle,
  stripVendorServicePriceFields,
  vendorServicePayloadHasPriceChange,
};

function lockOptsFromRowOrBody(
  rowOrBody?: Record<string, unknown> | null,
  explicit?: WarmpawzPayPricingLockOpts,
): WarmpawzPayPricingLockOpts {
  if (explicit?.isPackage) return { isPackage: true };
  if (rowOrBody && (isVendorServicePackagePayload(rowOrBody) || isVendorServicePackageRow(rowOrBody))) {
    return { isPackage: true };
  }
  return { isPackage: false };
}

export async function pricingLockMetaForStyle(
  serviceStyle: string | null | undefined,
  opts?: WarmpawzPayPricingLockOpts,
) {
  const pricingLocked = await isWarmpawzPayPricingLocked(serviceStyle, opts);
  return pricingLocked
    ? { pricingLocked: true as const, pricingLockReason: 'warmpawz_pay' as const }
    : { pricingLocked: false as const };
}

export async function stripVendorServiceRowPricesIfLocked<T extends Record<string, unknown>>(
  row: T,
  serviceStyle: string | null | undefined,
): Promise<T> {
  if (!(await isWarmpawzPayPricingLocked(serviceStyle, lockOptsFromRowOrBody(row)))) return row;
  return stripVendorServicePriceFields(row);
}

export async function rejectVendorServicePriceChangeIfLocked(
  serviceStyle: string | null | undefined,
  body: Record<string, unknown>,
  existingRow?: Record<string, unknown> | null,
): Promise<{ error: string; code: string } | null> {
  if (!vendorServicePayloadHasPriceChange(body)) return null;
  const opts = lockOptsFromRowOrBody(existingRow || body);
  if (!(await isWarmpawzPayPricingLocked(serviceStyle, opts))) return null;
  return {
    error:
      'Price cannot be changed for at_home/at_center services while Warmpawz Pay + Appointments is active. Contact platform admin for appointment fees.',
    code: 'PRICING_LOCKED',
  };
}
